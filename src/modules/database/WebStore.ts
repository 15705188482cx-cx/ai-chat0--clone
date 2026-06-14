// =============================================================================
// WebStore — IDataStore 的 Web (localStorage) 实现
// 规则 1(契约优先): 实现 IDataStore 所有方法
// 规则 2(不变式断言): 方法内部检查前置条件
// 规则 4(显式错误): 错误通过 IDataStore 定义的 Error 子类传递
// 规则 6(最小实现): 只实现当前需要的功能
// =============================================================================

import { Platform } from "react-native";
import { nanoid } from "nanoid";
import type { Persona } from "../persona/types";
import type { Memories } from "../persona/memoriesTypes";
import { createEmptyMemories } from "../persona/memoriesAnalyzer";
import type {
  IDataStore,
  ChatRecordRow,
  ConversationRow,
  MessageRow,
  StickerRow,
} from "./IDataStore";
import {
  StoreNotReadyError,
  InvalidArgumentError,
  StorageQuotaError,
} from "./IDataStore";

// ========== 常量（规则 3：无魔法值）==========
/** localStorage 存储键名 */
const STORAGE_KEY = "AI_CHAT_DB_V3";
/** 持久化防抖延迟（毫秒） */
const PERSIST_DEBOUNCE_MS = 300;
/** localStorage 配额安全阈值（字节） */
const QUOTA_SAFETY_BYTES = 4 * 1024 * 1024; // 4MB

// ========== 内部持久化快照类型 ==========
interface WebDbSnapshot {
  chatRecords: ChatRecordRow[];
  personas: Persona[];
  conversations: ConversationRow[];
  messages: MessageRow[];
  stickers: StickerRow[];
}

/** 空快照默认值（规则 3） */
const EMPTY_SNAPSHOT: WebDbSnapshot = {
  chatRecords: [],
  personas: [],
  conversations: [],
  messages: [],
  stickers: [],
};

// ========== Web 端颜色主题常量 ==========
export const COLORS = {
  background: "#EDEDED",
  danger: "#FF6B6B",
  textPrimary: "#333333",
  textSecondary: "#666666",
  brand: "#07C160",
  white: "#FFFFFF",
} as const;

/**
 * WebStore — 使用 localStorage 实现 IDataStore。
 * 适用于 Web/预览环境，所有数据存储在浏览器本地。
 */
// ========== 模块级防抖（避免跨实例竞态）==========
let _globalPersistTimer: ReturnType<typeof setTimeout> | null = null;

export class WebStore implements IDataStore {
  private db: WebDbSnapshot = { ...EMPTY_SNAPSHOT };
  private initialized = false;

  // ==================== 生命周期 ====================

  async init(): Promise<void> {
    if (this.initialized) return;
    // 取消任何挂起的持久化写入（来自之前实例的防抖可能仍待执行）
    if (_globalPersistTimer) {
      clearTimeout(_globalPersistTimer);
      _globalPersistTimer = null;
    }
    if (Platform.OS !== "web") {
      console.warn("[WebStore] 非 Web 平台，跳过初始化");
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as WebDbSnapshot;
        this.db = {
          chatRecords: Array.isArray(parsed.chatRecords) ? parsed.chatRecords : [],
          personas: Array.isArray(parsed.personas) ? parsed.personas : [],
          conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
          messages: Array.isArray(parsed.messages) ? parsed.messages : [],
          stickers: Array.isArray(parsed.stickers) ? parsed.stickers : [],
        };
      }
      this.initialized = true;
    } catch (err) {
      console.error("[WebStore] 从 localStorage 恢复失败，使用空数据:", err);
      this.db = { ...EMPTY_SNAPSHOT };
      this.initialized = true;
    }
  }

  // ==================== 内部方法 ====================

  /** 规则 2: 前置条件断言 — 必须在已初始化状态 */
  private assertReady(): void {
    if (!this.initialized) {
      throw new StoreNotReadyError("WebStore");
    }
  }

  /** 防抖持久化 — 延迟写入 localStorage */
  private schedulePersist(): void {
    if (_globalPersistTimer) {
      clearTimeout(_globalPersistTimer);
    }
    _globalPersistTimer = setTimeout(() => {
      _globalPersistTimer = null;
      this.flushPersist();
    }, PERSIST_DEBOUNCE_MS);
  }

  /** 立即写入 localStorage */
  private flushPersist(): void {
    if (Platform.OS !== "web") return;
    try {
      const serialized = JSON.stringify(this.db);
      if (serialized.length > QUOTA_SAFETY_BYTES) {
        console.warn(
          `[WebStore] 数据大小 ${(serialized.length / 1024 / 1024).toFixed(1)}MB 接近配额限制`,
        );
      }
      localStorage.setItem(STORAGE_KEY, serialized);
    } catch (err) {
      console.error("[WebStore] 持久化失败:", err);
      if (err instanceof DOMException && err.name === "QuotaExceededError") {
        throw new StorageQuotaError("localStorage 存储空间不足，请清理旧数据");
      }
    }
  }

  // ==================== 聊天记录 ====================

  async getChatRecordCount(): Promise<number> {
    this.assertReady();
    return this.db.chatRecords.length;
  }

  async getDistinctSenders(): Promise<string[]> {
    this.assertReady();
    const senders = new Set(this.db.chatRecords.map((r) => r.sender_name));
    return Array.from(senders).sort();
  }

  async getSamplesBySender(
    senderName: string,
    limit: number,
  ): Promise<ChatRecordRow[]> {
    this.assertReady();
    if (!senderName || senderName.trim().length === 0) {
      return [];
    }
    const safeLimit = Math.max(1, limit);
    const matches = this.db.chatRecords.filter(
      (r) => r.sender_name === senderName,
    );
    const shuffled = [...matches];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, safeLimit);
  }

  async bulkInsertChatRecords(
    records: Omit<ChatRecordRow, "id">[],
  ): Promise<number> {
    this.assertReady();
    if (!records || records.length === 0) return 0;

    const rows: ChatRecordRow[] = records.map((r) => ({
      id: nanoid(),
      batch_id: r.batch_id,
      sender_name: r.sender_name,
      content: r.content,
      timestamp: r.timestamp,
      session_id: r.session_id ?? null,
      type: r.type,
    }));
    this.db.chatRecords.push(...rows);
    this.schedulePersist();
    return rows.length;
  }

  async clearChatRecords(): Promise<void> {
    this.assertReady();
    this.db.chatRecords = [];
    this.schedulePersist();
  }

  async getConversationPairs(
    personAName: string,
    personBName: string,
    pairCount = 10,
  ): Promise<string[]> {
    this.assertReady();
    const records = this.db.chatRecords
      .filter(
        (r) =>
          r.type === "text" &&
          (r.sender_name === personAName || r.sender_name === personBName),
      )
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const pairs: string[] = [];
    for (let i = 1; i < records.length; i++) {
      const prev = records[i - 1];
      const curr = records[i];
      if (prev.sender_name === personAName && curr.sender_name === personBName) {
        pairs.push(
          `${personAName}: ${prev.content}\n${personBName}: ${curr.content}`,
        );
      }
    }
    return pairs.slice(-pairCount);
  }

  // ==================== Persona ====================

  async savePersona(persona: Persona): Promise<void> {
    this.assertReady();
    if (!persona.id) {
      throw new InvalidArgumentError("savePersona", "persona.id 不能为空");
    }
    if (!persona.name) {
      throw new InvalidArgumentError("savePersona", "persona.name 不能为空");
    }
    const idx = this.db.personas.findIndex((p) => p.id === persona.id);
    if (idx >= 0) {
      this.db.personas[idx] = persona;
    } else {
      this.db.personas.push(persona);
    }
    this.schedulePersist();
  }

  async getAllPersonas(): Promise<Persona[]> {
    this.assertReady();
    return [...this.db.personas];
  }

  async getPersonaById(id: string): Promise<Persona | null> {
    this.assertReady();
    if (!id) return null;
    return this.db.personas.find((p) => p.id === id) || null;
  }

  async deletePersona(id: string): Promise<void> {
    this.assertReady();
    if (!id) return;
    this.db.personas = this.db.personas.filter((p) => p.id !== id);
    this.db.conversations = this.db.conversations.filter(
      (c) => c.persona_id !== id,
    );
    this.db.messages = this.db.messages.filter((m) => {
      const conv = this.db.conversations.find((c) => c.id === m.conversation_id);
      return conv != null;
    });
    this.schedulePersist();
  }

  // ==================== 会话 ====================

  async createConversation(
    personaId: string,
    title?: string,
  ): Promise<ConversationRow> {
    this.assertReady();
    if (!personaId) {
      throw new InvalidArgumentError("createConversation", "personaId 不能为空");
    }
    const now = new Date().toISOString();
    const conv: ConversationRow = {
      id: nanoid(),
      persona_id: personaId,
      title: title || "新对话",
      created_at: now,
      updated_at: now,
    };
    this.db.conversations.push(conv);
    this.schedulePersist();
    return conv;
  }

  async getConversationById(id: string): Promise<ConversationRow | null> {
    this.assertReady();
    if (!id) return null;
    return this.db.conversations.find((c) => c.id === id) || null;
  }

  async getAllConversations(): Promise<ConversationRow[]> {
    this.assertReady();
    return [...this.db.conversations].sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at),
    );
  }

  async updateConversationTimestamp(conversationId: string): Promise<void> {
    this.assertReady();
    const conv = this.db.conversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.updated_at = new Date().toISOString();
      this.schedulePersist();
    }
  }

  async deleteConversation(id: string): Promise<void> {
    this.assertReady();
    if (!id) return;
    this.db.messages = this.db.messages.filter((m) => m.conversation_id !== id);
    this.db.conversations = this.db.conversations.filter((c) => c.id !== id);
    this.schedulePersist();
  }

  async updateConversationTitle(id: string, title: string): Promise<void> {
    this.assertReady();
    const conv = this.db.conversations.find((c) => c.id === id);
    if (conv) {
      conv.title = title;
      conv.updated_at = new Date().toISOString();
      this.schedulePersist();
    }
  }

  // ==================== 消息 ====================

  async insertMessage(
    conversationId: string,
    role: "user" | "persona",
    textContent: string,
    stickerId?: string,
  ): Promise<void> {
    this.assertReady();
    if (!["user", "persona"].includes(role)) {
      throw new InvalidArgumentError(
        "insertMessage",
        `无效角色: ${role}，必须是 "user" 或 "persona"`,
      );
    }
    const msg: MessageRow = {
      id: nanoid(),
      conversation_id: conversationId,
      role,
      text_content: textContent,
      sticker_id: stickerId || null,
      created_at: new Date().toISOString(),
    };
    this.db.messages.push(msg);
    const conv = this.db.conversations.find(
      (c) => c.id === conversationId,
    );
    if (conv) {
      conv.updated_at = msg.created_at;
    }
    this.schedulePersist();
  }

  async getLatestMessages(
    conversationId: string,
    limit: number,
  ): Promise<MessageRow[]> {
    this.assertReady();
    const safeLimit = Math.max(1, limit);
    const msgs = this.db.messages.filter(
      (m) => m.conversation_id === conversationId,
    );
    return msgs.slice(-safeLimit);
  }

  // ==================== 表情包 ====================

  async insertSticker(params: {
    filePath: string;
    label?: string;
    embedding?: string;
  }): Promise<StickerRow> {
    this.assertReady();
    const sticker: StickerRow = {
      id: nanoid(),
      file_path: params.filePath,
      label: params.label || null,
      embedding: params.embedding || null,
      imported_at: new Date().toISOString(),
    };
    this.db.stickers.push(sticker);
    this.schedulePersist();
    return sticker;
  }

  async getAllStickers(): Promise<StickerRow[]> {
    this.assertReady();
    return [...this.db.stickers];
  }

  async deleteStickerById(id: string): Promise<void> {
    this.assertReady();
    this.db.stickers = this.db.stickers.filter((s) => s.id !== id);
    this.schedulePersist();
  }

  // ======== Memories ========

  async getMemories(personaId: string): Promise<Memories> {
    this.assertReady();
    const key = `memories_${personaId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return createEmptyMemories();
    try {
      return JSON.parse(raw) as Memories;
    } catch {
      return createEmptyMemories();
    }
  }

  async saveMemories(personaId: string, memories: Memories): Promise<void> {
    this.assertReady();
    const key = `memories_${personaId}`;
    localStorage.setItem(key, JSON.stringify(memories));
  }

}