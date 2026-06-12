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
import type {
  IDataStore,
  ChatRecordRow,
  ConversationRow,
  MessageRow,
} from "./IDataStore";
import {
  StoreNotReadyError,
  InvalidArgumentError,
} from "./IDataStore";

// ========== 常量（规则 3：无魔法值）==========
/** localStorage 存储键名 */
const STORAGE_KEY = "AI_CHAT_DB_V2";

// ========== 内部持久化快照类型 ==========
interface WebDbSnapshot {
  chatRecords: ChatRecordRow[];
  personas: Persona[];
  conversations: ConversationRow[];
  messages: MessageRow[];
}

/** 空快照默认值（规则 3） */
const EMPTY_SNAPSHOT: WebDbSnapshot = {
  chatRecords: [],
  personas: [],
  conversations: [],
  messages: [],
};

/**
 * WebStore — 使用 localStorage 实现 IDataStore。
 * 适用于 Web/预览环境，所有数据存储在浏览器本地。
 */
export class WebStore implements IDataStore {
  private db: WebDbSnapshot = { ...EMPTY_SNAPSHOT };
  private initialized = false;

  // ==================== 生命周期 ====================

  async init(): Promise<void> {
    if (this.initialized) return;
    if (Platform.OS !== "web") {
      console.warn("[WebStore] 非 Web 平台，跳过初始化");
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as WebDbSnapshot;
        // 安全恢复：每个字段都用兜底值（规则 7：失败快速 + 有损恢复）
        this.db = {
          chatRecords: Array.isArray(parsed.chatRecords) ? parsed.chatRecords : [],
          personas: Array.isArray(parsed.personas) ? parsed.personas : [],
          conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
          messages: Array.isArray(parsed.messages) ? parsed.messages : [],
        };
      }
      this.initialized = true;
    } catch (err) {
      // 规则 4: 显式错误，不清空
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

  /** 持久化当前数据到 localStorage */
  private persist(): void {
    this.assertReady();
    if (Platform.OS !== "web") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.db));
    } catch (err) {
      console.error("[WebStore] 持久化失败:", err);
      // 规则 7: 失败快速 — 持久化失败不阻止内存操作继续
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
    // 规则 2: 空字符串返回空数组
    if (!senderName || senderName.trim().length === 0) {
      return [];
    }
    const safeLimit = Math.max(1, limit);
    const matches = this.db.chatRecords.filter(
      (r) => r.sender_name === senderName,
    );
    // Fisher-Yates 洗牌
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
    this.persist();
    return rows.length;
  }

  // ==================== Persona ====================

  async savePersona(persona: Persona): Promise<void> {
    this.assertReady();
    // 规则 2: 前置条件断言
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
    this.persist();
  }

  async getAllPersonas(): Promise<Persona[]> {
    this.assertReady();
    // 返回副本，防止外部修改内部状态
    return [...this.db.personas];
  }

  async getPersonaById(id: string): Promise<Persona | null> {
    this.assertReady();
    // 规则 2: 空 ID 返回 null
    if (!id) return null;
    return this.db.personas.find((p) => p.id === id) || null;
  }

  async deletePersona(id: string): Promise<void> {
    this.assertReady();
    if (!id) return;
    const beforeCount = this.db.personas.length;
    this.db.personas = this.db.personas.filter((p) => p.id !== id);
    this.db.conversations = this.db.conversations.filter(
      (c) => c.persona_id !== id,
    );
    this.db.messages = this.db.messages.filter((m) => {
      const conv = this.db.conversations.find((c) => c.id === m.conversation_id);
      return conv?.persona_id !== id;
    });
    if (this.db.personas.length === beforeCount) {
      console.warn(`[WebStore] deletePersona: id=${id} 未找到，无操作`);
    }
    this.persist();
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
    this.persist();
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
      this.persist();
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
    // 更新会话时间戳
    const conv = this.db.conversations.find(
      (c) => c.id === conversationId,
    );
    if (conv) {
      conv.updated_at = msg.created_at;
    }
    this.persist();
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
    // 按时间升序，取最后 safeLimit 条
    return msgs.slice(-safeLimit);
  }
}
