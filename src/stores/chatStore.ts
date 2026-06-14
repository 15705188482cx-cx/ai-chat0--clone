import { create } from "zustand";
import { nanoid } from "nanoid";
import { getStore } from "../modules/database/storeProvider";
import { getConversationPairs } from "../modules/database/repositories/chatRecordRepo";
import { getPersonaById, getMemories } from "../modules/persona/personaService";
import type { Persona } from "../modules/persona/types";
import type { Memories } from "../modules/persona/memoriesTypes";
import { buildMessages } from "../modules/aiEngine/promptBuilder";
import { trimHistory } from "../modules/aiEngine/contextManager";
import { maskPII } from "../modules/aiEngine/piiMasker";
import { sanitizeUserInput } from "../modules/aiEngine/inputSanitizer";
import { filterResponse } from "../modules/aiEngine/contentFilter";
import { getRateLimiter } from "../modules/aiEngine/rateLimiter";
import { chatNonStreaming } from "../modules/aiEngine/deepseekService";
import { StickerService } from "../modules/stickerManager/stickerService";

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
const API_TIMEOUT_MS = 25000;
const GLOBAL_THINKING_TIMEOUT_MS = 35000;
const MAX_MESSAGE_COUNT = 50;
const DEFAULT_RATE_LIMIT = 50;

// ========== 安全定时器（实例级别，不再使用模块级可变状态）==========
class ThinkingTimer {
  private _timer: ReturnType<typeof setTimeout> | null = null;

  clear(): void {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  set(callback: () => void, ms: number): void {
    this.clear();
    this._timer = setTimeout(callback, ms);
  }
}

// ========== API 调用逻辑（从 Store 中提取）==========
async function callChatAPI(
  persona: Persona,
  sanitizedUserInput: string,
  currentMessages: UIMessage[],
  conversationId: string,
): Promise<{ replyText: string; stickerUri: string | null }> {
  // 获取对话样本
  let samples: string[] = [];
  try {
    samples = await getConversationPairs(persona.sourceSender, "我", 10);
  } catch (err) {
    console.warn("[chatAPI] 获取对话样本失败:", err);
  }

  const maskedSamples = samples.map((s) => maskPII(s));

  // 构建历史消息
  const history = currentMessages
    .filter((m) => !m.isStreaming && m.text.length > 0)
    .slice(0, -2)
    .map((m) => ({ role: m.role as "user" | "persona", text: m.text }));
  const trimmedHistory = trimHistory(history);
  // 加载共同记忆
  let memories: Memories | null = null;
  try {
    memories = await getMemories(persona.id);
  } catch (err) {
    console.warn("[chatAPI] load memories failed:", err);
  }

  const apiMessages = buildMessages(persona, maskedSamples, trimmedHistory, sanitizedUserInput, memories);

  // 调用 API（带超时）
  const reply = await Promise.race([
    chatNonStreaming(apiMessages),
    new Promise<string>((_, reject) =>
      setTimeout(
        () => reject(new Error("API 响应超时（" + (API_TIMEOUT_MS / 1000) + "秒）")),
        API_TIMEOUT_MS,
      ),
    ),
  ]);

  const filtered = filterResponse(reply || "回复失败，请重试");

  // 搜索表情包
  let stickerUri: string | null = null;
  try {
    const matches = await StickerService.search(filtered, 1);
    if (matches.length > 0) stickerUri = matches[0].filePath;
  } catch (err) {
    console.warn("[chatAPI] 表情包搜索失败:", err);
  }

  // 写入 AI 回复到 DB
  try {
    const store = await getStore();
    await store.insertMessage(conversationId, "persona", filtered, stickerUri ?? undefined);
  } catch (err) {
    console.warn("[chatAPI] AI 回复写入 DB 失败:", err);
  }

  return { replyText: filtered, stickerUri };
}

// ========== Store ==========
export const useChatStore = create<ChatState>((set, get) => {
  const thinkingTimer = new ThinkingTimer();

  return {
    // ========== 初始状态 ==========
    messages: [],
    isThinking: false,
    persona: null,
    conversationId: null,
    rateLimitRemaining: DEFAULT_RATE_LIMIT,

    // ========== 初始化会话 ==========
    initConversation: async (personaId: string) => {
      const persona = await getPersonaById(personaId);
      if (!persona) throw new Error("分身不存在");
      await get().setPersonaAndInitConversation(persona);
    },

    setPersonaAndInitConversation: async (persona: Persona) => {
      const store = await getStore();
      const conv = await store.createConversation(
        persona.id,
        "与 " + persona.name + " 的对话",
      );
      set({ persona, conversationId: conv.id, messages: [], isThinking: false });
    },

    loadFromConversationId: async (convId: string) => {
      const store = await getStore();
      const conv = await store.getConversationById(convId);
      if (!conv) throw new Error("会话不存在");

      const persona = await store.getPersonaById(conv.persona_id);
      if (!persona) throw new Error("分身不存在");

      const messages = await store.getLatestMessages(convId, MAX_MESSAGE_COUNT);
      const uiMessages: UIMessage[] = messages.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text_content,
        createdAt: m.created_at,
        stickerUri: m.sticker_id,
      }));

      set({ persona, conversationId: convId, messages: uiMessages, isThinking: false });
    },

    loadMessages: async () => {
      const { conversationId } = get();
      if (!conversationId) return;
      const store = await getStore();
      const messages = await store.getLatestMessages(conversationId, MAX_MESSAGE_COUNT);
      const uiMessages: UIMessage[] = messages.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text_content,
        createdAt: m.created_at,
        stickerUri: m.sticker_id,
      }));
      set({ messages: uiMessages });
    },

    // ========== 发送消息 ==========
    sendMessage: async (text: string) => {
      const { conversationId, persona } = get();
      if (!conversationId || !persona) {
        console.error("[chatStore] 无法发送：conversationId 或 persona 缺失");
        set({ isThinking: false });
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
      if (!sanitized) return;

      // 写入用户消息到 DB（非阻塞）
      const userMsg: UIMessage = {
        id: nanoid(),
        role: "user",
        text: sanitized,
        createdAt: new Date().toISOString(),
      };
      const store = await getStore();
      try {
        await store.insertMessage(conversationId, "user", sanitized);
      } catch (err) {
        console.warn("[chatStore] 用户消息写入 DB 失败:", err);
      }

      // 创建 AI 回复占位
      const aiMsgId = nanoid();
      set((s) => ({
        messages: [...s.messages, userMsg, {
          id: aiMsgId,
          role: "persona",
          text: "",
          createdAt: new Date().toISOString(),
          isStreaming: true,
        }],
        isThinking: true,
      }));

      // 设置全局安全超时
      thinkingTimer.set(() => {
        const state = get();
        if (state.isThinking) {
          console.warn("[chatStore] 全局安全超时触发，强制解锁 isThinking");
          set({
            isThinking: false,
            messages: state.messages.map((m: UIMessage) =>
              m.isStreaming ? { ...m, text: m.text || "回复超时，请重试", isStreaming: false } : m,
            ),
          });
        }
        thinkingTimer.clear();
      }, GLOBAL_THINKING_TIMEOUT_MS);

      try {
        const { replyText, stickerUri } = await callChatAPI(
          persona,
          sanitized,
          get().messages,
          conversationId,
        );

        thinkingTimer.clear();
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === aiMsgId ? { ...m, text: replyText, isStreaming: false, stickerUri } : m,
          ),
          isThinking: false,
          rateLimitRemaining: limiter.remaining,
        }));
      } catch (err) {
        thinkingTimer.clear();
        const errorText = "回复失败：" + (err instanceof Error ? err.message : "未知错误");
        console.error("[chatStore] sendMessage 失败:", err);
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
      thinkingTimer.clear();
      const state = get();
      set({
        isThinking: false,
        messages: state.messages.map((m: UIMessage) =>
          m.isStreaming ? { ...m, text: m.text || "已手动取消", isStreaming: false } : m,
        ),
      });
    },

    // ========== 设置会话 ==========
    setConversation: (conversationId, persona) => {
      set({ conversationId, persona, messages: [] });
    },

    // ========== 重置 ==========
    reset: () => {
      thinkingTimer.clear();
      set({ messages: [], isThinking: false, persona: null, conversationId: null });
    },
  };
});
