import { create } from "zustand";
import { nanoid } from "nanoid";
import { getStore } from "../modules/database/storeProvider";
import { getConversationPairs } from "../modules/database/repositories/chatRecordRepo";
import type { IDataStore } from "../modules/database/IDataStore";
import { getPersonaById } from "../modules/persona/personaService";
import type { Persona } from "../modules/persona/types";
import { buildMessages } from "../modules/aiEngine/promptBuilder";
import { trimHistory } from "../modules/aiEngine/contextManager";
import { maskPII } from "../modules/aiEngine/piiMasker";
import { sanitizeUserInput } from "../modules/aiEngine/inputSanitizer";
import { filterResponse } from "../modules/aiEngine/contentFilter";
import { getRateLimiter } from "../modules/aiEngine/rateLimiter";
import { chatNonStreaming } from "../modules/aiEngine/deepseekService";
import { StickerService } from "../modules/stickerManager/stickerService";
import { getConversationById } from "../modules/database/repositories/conversationRepo";

// ========== 类型定义 ==========
export interface UIMessage {
  id: string;
  role: "user" | "persona";
  text: string;
  createdAt: string;
  isStreaming?: boolean;
  stickerUri?: string | null;
}

export interface ChatState {
  messages: UIMessage[];
  isThinking: boolean;
  persona: Persona | null;
  conversationId: string | null;
  rateLimitRemaining: number;

  initConversation: (personaId: string) => Promise<void>;
  setPersonaAndInitConversation: (persona: Persona) => Promise<void>;
  loadFromConversationId: (convId: string) => Promise<void>;
  loadMessages: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  setConversation: (conversationId: string | null, persona: Persona | null) => void;
  reset: () => void;
  forceUnfreeze: () => void;
}

// ========== 常量（规则 3：无魔法值）==========
/** API 响应超时时间（毫秒） */
const API_TIMEOUT_MS = 25000;
/** 全局安全超时时间，防止 isThinking 永久 true */
const GLOBAL_THINKING_TIMEOUT_MS = 35000;
/** 每次 API 调用的最大消息上下文数 */
const MAX_MESSAGE_COUNT = 50;
/** 限流器默认值 */
const DEFAULT_RATE_LIMIT = 50;

// ========== 全局安全定时器（规则 7：失败快速）==========
let globalThinkingTimer: ReturnType<typeof setTimeout> | null = null;

function clearGlobalTimer(): void {
  if (globalThinkingTimer) {
    clearTimeout(globalThinkingTimer);
    globalThinkingTimer = null;
  }
}

function setGlobalTimer(set: any): void {
  clearGlobalTimer();
  globalThinkingTimer = setTimeout(() => {
    const state = useChatStore.getState();
    if (state.isThinking) {
      console.warn("[chatStore] 全局安全超时触发，强制解锁 isThinking");
      set({
        isThinking: false,
        messages: state.messages.map((m: UIMessage) =>
          m.isStreaming
            ? { ...m, text: m.text || "回复超时，请重试", isStreaming: false }
            : m,
        ),
      });
    }
    clearGlobalTimer();
  }, GLOBAL_THINKING_TIMEOUT_MS);
}

// ========== Store（规则 4：无空 catch）==========
export const useChatStore = create<ChatState>((set, get) => ({
  // ========== 初始状态 ==========
  messages: [],
  isThinking: false,
  persona: null,
  conversationId: null,
  rateLimitRemaining: DEFAULT_RATE_LIMIT,

  // ========== 初始化会话 ==========
  initConversation: async (personaId: string) => {
    try {
      const persona = await getPersonaById(personaId);
      if (!persona) throw new Error("分身不存在");

      const store: IDataStore = await getStore();
      const conv = await store.createConversation(
        persona.id,
        "与 " + persona.name + " 的对话",
      );
      set({ persona, conversationId: conv.id, messages: [], isThinking: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "创建会话失败";
      console.error("[chatStore] initConversation 失败:", err);
      throw new Error(msg);
    }
  },

  // ========== 设置分身并初始化会话 ==========
  setPersonaAndInitConversation: async (persona: Persona) => {
    try {
      const store: IDataStore = await getStore();
      const conv = await store.createConversation(
        persona.id,
        "与 " + persona.name + " 的对话",
      );
      set({ persona, conversationId: conv.id, messages: [], isThinking: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "创建会话失败";
      console.error("[chatStore] setPersonaAndInitConversation 失败:", err);
      throw new Error(msg);
    }
  },

  // ========== 从会话 ID 加载 ==========
  loadFromConversationId: async (convId: string) => {
    try {
      const conv = await getConversationById(convId);
      if (!conv) throw new Error("会话不存在");
      const persona = await getPersonaById(conv.persona_id);
      if (!persona) throw new Error("分身不存在");
      set({ persona, conversationId: convId, messages: [], isThinking: false });
    } catch (err) {
      console.error("[chatStore] loadFromConversationId 失败:", err);
      throw err;
    }
  },

  // ========== 加载消息 ==========
  loadMessages: async () => {
    const { conversationId } = get();
    if (!conversationId) return;

    try {
      const store: IDataStore = await getStore();
      const rows = await store.getLatestMessages(conversationId, MAX_MESSAGE_COUNT);
      const uiMessages: UIMessage[] = rows.map((r) => ({
        id: r.id,
        role: r.role as "user" | "persona",
        text: r.text_content,
        createdAt: r.created_at,
      }));
      set({ messages: uiMessages });
    } catch (err) {
      console.error("[chatStore] loadMessages 失败:", err);
    }
  },

  // ========== 发送消息（核心功能）==========
  sendMessage: async (text: string) => {
    const { persona, conversationId } = get();

    // 规则 2：前置条件检查
    if (!persona || !conversationId) {
      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: nanoid(),
            role: "persona",
            text: "请先选择一个分身或会话",
            createdAt: new Date().toISOString(),
          },
        ],
      }));
      return;
    }

    // 规则 2：persona 必须有 sourceSender
    if (!persona.sourceSender) {
      console.error("[chatStore] persona 缺少 sourceSender:", persona.id);
      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: nanoid(),
            role: "persona",
            text: "分身配置错误（缺少聊天对象来源）",
            createdAt: new Date().toISOString(),
          },
        ],
      }));
      return;
    }

    // 限流检查
    const limiter = getRateLimiter();
    if (!limiter.check()) {
      const waitMinutes = Math.ceil((DEFAULT_RATE_LIMIT - limiter.remaining) / 50 * 60);
      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: nanoid(),
            role: "persona",
            text: "回复太频繁，请 " + waitMinutes + " 分钟后再试",
            createdAt: new Date().toISOString(),
          },
        ],
      }));
      return;
    }
    set({ rateLimitRemaining: limiter.remaining });

    // 用户输入清洗
    const sanitized = sanitizeUserInput(text);
    if (!sanitized) {
      console.warn("[chatStore] 用户输入被完全过滤");
      return;
    }

    // 写入用户消息到 DB
    const userMsg: UIMessage = {
      id: nanoid(),
      role: "user",
      text: sanitized,
      createdAt: new Date().toISOString(),
    };

    try {
      const store = await getStore();
      await store.insertMessage(conversationId, "user", sanitized);
    } catch (err) {
      console.warn("[chatStore] 用户消息写入 DB 失败:", err);
      // 非关键路径，不阻塞
    }

    // 创建 AI 回复占位
    const aiMsgId = nanoid();
    set((s) => ({
      messages: [
        ...s.messages,
        userMsg,
        {
          id: aiMsgId,
          role: "persona",
          text: "",
          createdAt: new Date().toISOString(),
          isStreaming: true,
        },
      ],
      isThinking: true,
    }));
    setGlobalTimer(set);

    try {
      // 获取对话样本
      let samples: string[] = [];
      try {
        samples = await getConversationPairs(persona.sourceSender, "我", 10);
      } catch (err) {
        console.warn("[chatStore] 获取对话样本失败:", err);
      }

      const maskedSamples = samples.map((s) => maskPII(s));
      const { messages: currentMessages } = get();
      const history = currentMessages
        .filter((m) => !m.isStreaming && m.text.length > 0)
        .slice(0, -2)
        .map((m) => ({ role: m.role as "user" | "persona", text: m.text }));
      const trimmedHistory = trimHistory(history);
      const apiMessages = buildMessages(persona, maskedSamples, trimmedHistory, sanitized);

      // 调用 API（带超时）
      let reply = "";
      try {
        reply = await Promise.race([
          chatNonStreaming(apiMessages),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error("API 响应超时（" + (API_TIMEOUT_MS / 1000) + "秒）")), API_TIMEOUT_MS),
          ),
        ]);
      } catch (err) {
        reply = "回复失败：" + (err instanceof Error ? err.message : "未知错误");
        console.error("[chatStore] API 调用失败:", err);
      }

      // 内容过滤
      const filtered = filterResponse(reply || "回复失败，请重试");

      // 搜索表情包
      let stickerUri: string | null = null;
      try {
        const matches = await StickerService.search(filtered, 1);
        if (matches.length > 0) stickerUri = matches[0].filePath;
      } catch (err) {
        console.warn("[chatStore] 表情包搜索失败:", err);
      }

      // 写入 AI 回复到 DB
      try {
        const store = await getStore();
        await store.insertMessage(conversationId, "persona", filtered, stickerUri ?? undefined);
      } catch (err) {
        console.warn("[chatStore] AI 回复写入 DB 失败:", err);
      }

      // 更新 UI
      clearGlobalTimer();
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === aiMsgId
            ? { ...m, text: filtered, isStreaming: false, stickerUri }
            : m,
        ),
        isThinking: false,
        rateLimitRemaining: limiter.remaining,
      }));
    } catch (err) {
      // 外层 catch — 兜底
      clearGlobalTimer();
      const errorText =
        "回复失败：" + (err instanceof Error ? err.message : "未知错误");
      console.error("[chatStore] sendMessage 整体失败:", err);
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === aiMsgId ? { ...m, text: errorText, isStreaming: false } : m,
        ),
        isThinking: false,
      }));
    }
  },

  // ========== 强制解锁 ==========
  forceUnfreeze: () => {
    clearGlobalTimer();
    const state = get();
    set({
      isThinking: false,
      messages: state.messages.map((m: UIMessage) =>
        m.isStreaming
          ? { ...m, text: m.text || "已手动取消失败", isStreaming: false }
          : m,
      ),
    });
  },

  // ========== 设置会话 ==========
  setConversation: (conversationId, persona) => {
    set({ conversationId, persona, messages: [] });
  },

  // ========== 重置 ==========
  reset: () => {
    clearGlobalTimer();
    set({ messages: [], isThinking: false, persona: null, conversationId: null });
  },
}));
