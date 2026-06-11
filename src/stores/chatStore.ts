import { create } from "zustand";
import { nanoid } from "nanoid";
import { getConversationPairs } from "../modules/database/repositories/chatRecordRepo";
import {
  insertMessage,
  getLatestMessages,
  type MessageRow,
} from "../modules/database/repositories/messageRepo";
import {
  createConversation,
  type ConversationRow,
} from "../modules/database/repositories/conversationRepo";
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

export interface UIMessage {
  id: string;
  role: "user" | "persona";
  text: string;
  createdAt: string;
  isStreaming?: boolean;
  stickerUri?: string | null;
}

interface ChatState {
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

/** 全局安全超时：防止 isThinking 永远卡在 true */
let globalThinkingTimer: ReturnType<typeof setTimeout> | null = null;
function clearGlobalTimer() {
  if (globalThinkingTimer) { clearTimeout(globalThinkingTimer); globalThinkingTimer = null; }
}
function setGlobalTimer(set: any) {
  clearGlobalTimer();
  globalThinkingTimer = setTimeout(() => {
    const state = useChatStore.getState();
    if (state.isThinking) {
      set({ isThinking: false, messages: state.messages.map(m => m.isStreaming ? { ...m, text: m.text || "（回复超时，请重试）", isStreaming: false } : m) });
    }
    clearGlobalTimer();
  }, 35000); // 35 秒全局硬超时
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isThinking: false,
  persona: null,
  conversationId: null,
  rateLimitRemaining: 50,

  initConversation: async (personaId: string) => {
    const persona = await getPersonaById(personaId);
    if (!persona) throw new Error("分身不存在");

    const conv: ConversationRow = await createConversation(persona.id, `与 ${persona.name} 的对话`);
    set({ persona, conversationId: conv.id, messages: [], isThinking: false });
  },

  setPersonaAndInitConversation: async (persona: Persona) => {
    const conv: ConversationRow = await createConversation(persona.id, `与 ${persona.name} 的对话`);
    set({ persona, conversationId: conv.id, messages: [], isThinking: false });
  },

  loadFromConversationId: async (convId: string) => {
    const conv = await getConversationById(convId);
    if (!conv) throw new Error("会话不存在");
    const persona = await getPersonaById(conv.persona_id);
    if (!persona) throw new Error("分身不存在");
    set({ persona, conversationId: convId, messages: [], isThinking: false });
  },

  loadMessages: async () => {
    const { conversationId } = get();
    if (!conversationId) return;
    const rows = await getLatestMessages(conversationId, 50);
    const uiMessages: UIMessage[] = rows.reverse().map((r: MessageRow) => ({
      id: r.id,
      role: r.role as "user" | "persona",
      text: r.text_content,
      createdAt: r.created_at,
    }));
    set({ messages: uiMessages });
  },

  sendMessage: async (text: string) => {
    const { persona, conversationId } = get();
    if (!persona || !conversationId) {
      set((s) => ({ messages: [...s.messages, { id: nanoid(), role: 'persona' as const, text: '请先创建分身或选择会话', createdAt: new Date().toISOString() }] }));
      return;
    }
    const limiter = getRateLimiter();
    if (!limiter.check()) {
      set((s) => ({
        messages: [...s.messages, { id: nanoid(), role: "persona", text: "回复太频繁，请稍后再试", createdAt: new Date().toISOString() }],
      }));
      return;
    }
    set({ rateLimitRemaining: limiter.remaining });

    const sanitized = sanitizeUserInput(text);
    if (!sanitized) return;

    const userMsg = { id: nanoid(), role: "user" as const, text: sanitized, createdAt: new Date().toISOString() };
    try {
      await insertMessage({ conversationId, role: "user", textContent: sanitized });
    } catch {
      // 静默处理：消息写入失败不阻塞 UI
    }

    const aiMsgId = nanoid();
    set((s) => ({
      messages: [...s.messages, userMsg, { id: aiMsgId, role: "persona", text: "", createdAt: new Date().toISOString(), isStreaming: true }],
      isThinking: true,
    }));
    setGlobalTimer(set);

    try {
      const samples = await getConversationPairs(persona.sourceSender, "我", 10).catch(() => [] as string[]);
      const maskedSamples = samples.map((s) => maskPII(s));
      const { messages: currentMessages } = get();
      const history = currentMessages.filter((m) => !m.isStreaming && m.text.length > 0).slice(0, -2).map((m) => ({ role: m.role as "user" | "persona", text: m.text }));
      const trimmedHistory = trimHistory(history);
      const apiMessages = buildMessages(persona, maskedSamples, trimmedHistory, sanitized);

      const reply = await Promise.race([
        chatNonStreaming(apiMessages),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('API 响应超时（20秒）')), 20000)),
      ]);

      const filtered = filterResponse(reply || "（回复生成失败，请重试）");

      let stickerUri = null;
      try { const matches = await StickerService.search(filtered, 1); if (matches.length > 0) stickerUri = matches[0].filePath; } catch {}

      try {
        await insertMessage({ conversationId, role: "persona", textContent: filtered, stickerId: stickerUri ?? undefined });
      } catch {
        // 静默处理
      }

      clearGlobalTimer();
      set((s) => ({
        messages: s.messages.map((m) => m.id === aiMsgId ? { ...m, text: filtered, isStreaming: false } : m),
        isThinking: false,
        rateLimitRemaining: limiter.remaining,
      }));
    } catch (err) {
      clearGlobalTimer();
      const errorText = err instanceof Error ? `回复失败：${err.message}` : "回复失败，请重试";
      set((s) => ({
        messages: s.messages.map((m) => m.id === aiMsgId ? { ...m, text: errorText, isStreaming: false } : m),
        isThinking: false,
      }));
    }
  },

  forceUnfreeze: () => {
    clearGlobalTimer();
    const state = get();
    set({
      isThinking: false,
      messages: state.messages.map(m => m.isStreaming ? { ...m, text: m.text || "（已手动取消）", isStreaming: false } : m),
    });
  },

  setConversation: (conversationId, persona) => {
    set({ conversationId, persona, messages: [] });
  },

  reset: () => {
    clearGlobalTimer();
    set({ messages: [], isThinking: false, persona: null, conversationId: null });
  },
}));
