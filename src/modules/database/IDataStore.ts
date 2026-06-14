// =============================================================================
// IDataStore — 存储层统一接口契约（扩展版）
// 规则 1(契约优先): 所有操作的输入/输出/错误类型在此定义
// 规则 2(不变式断言): 每个方法的前置/后置条件用 JSDoc 文档化
// 规则 4(显式错误): 所有错误通过 Error 子类传递，不静默吞掉
// 规则 5(可测试性): 可被 Mock 实现替换
// =============================================================================

import type { Persona } from "../persona/types";
import type { Memories } from "../persona/memoriesTypes";

// ========== 通用行类型 ==========
export interface ChatRecordRow {
  id: string;
  batch_id: string;
  sender_name: string;
  content: string;
  timestamp: string;
  session_id: string | null;
  type: string;
}

export interface ConversationRow {
  id: string;
  persona_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "persona";
  text_content: string;
  sticker_id: string | null;
  created_at: string;
}

export interface StickerRow {
  id: string;
  file_path: string;
  label: string | null;
  embedding: string | null;
  imported_at: string;
}

// ========== 显式错误类型（规则 4）==========
/** Store 未初始化时调用方法 */
export class StoreNotReadyError extends Error {
  constructor(method: string) {
    super(`[DataStore] ${method} 调用失败：Store 尚未初始化`);
    this.name = "StoreNotReadyError";
  }
}

/** 查询的记录不存在 */
export class RecordNotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`[DataStore] ${entity}(id=${id}) 不存在`);
    this.name = "RecordNotFoundError";
  }
}

/** 无效参数 */
export class InvalidArgumentError extends Error {
  constructor(method: string, reason: string) {
    super(`[DataStore] ${method} 参数错误：${reason}`);
    this.name = "InvalidArgumentError";
  }
}

/** 存储配额超限 */
export class StorageQuotaError extends Error {
  constructor(detail: string) {
    super(`[DataStore] 存储配额超限：${detail}`);
    this.name = "StorageQuotaError";
  }
}

// ========== IDataStore 接口契约 ==========
export interface IDataStore {
  /** 初始化存储层。调用所有其他方法前必须先调用此方法。 */
  init(): Promise<void>;

  // ── 聊天记录（ChatRecord）──

  /**
   * 获取聊天记录总数。
   * @returns >= 0 的整数
   * @throws StoreNotReadyError 未初始化
   */
  getChatRecordCount(): Promise<number>;

  /**
   * 获取所有不重复的发件人名称列表。
   * @returns 按字母序排列的名称数组（空数组表示无数据）
   * @throws StoreNotReadyError 未初始化
   */
  getDistinctSenders(): Promise<string[]>;

  /**
   * 获取指定发件人的随机样本记录。
   * @param senderName 发件人名称（空字符串返回 []）
   * @param limit 最大条数（<=0 时使用默认值 1）
   * @throws StoreNotReadyError 未初始化
   */
  getSamplesBySender(senderName: string, limit: number): Promise<ChatRecordRow[]>;

  /**
   * 批量插入聊天记录。
   * @param records 记录数组（不含 id，由实现层生成）
   * @returns 实际插入条数
   * @throws StoreNotReadyError 未初始化
   */
  bulkInsertChatRecords(records: Omit<ChatRecordRow, "id">[]): Promise<number>;

  /**
   * 清空所有聊天记录（用于重新导入）。
   * @throws StoreNotReadyError 未初始化
   */
  clearChatRecords(): Promise<void>;

  /**
   * 获取两个参与者之间的对话对样本（一问一答）。
   * @param personAName 参与者 A（通常是"我"）
   * @param personBName 参与者 B
   * @param pairCount 对数（默认 10）
   * @returns 格式化的对话对文本数组
   * @throws StoreNotReadyError 未初始化
   */
  getConversationPairs(
    personAName: string,
    personBName: string,
    pairCount?: number,
  ): Promise<string[]>;

  // ── Persona ──

  /**
   * 保存（插入或更新）分身。
   * @throws InvalidArgumentError persona.id 或 persona.name 为空
   * @throws StoreNotReadyError 未初始化
   */
  savePersona(persona: Persona): Promise<void>;

  /** 获取所有分身，按创建时间倒序。 */
  getAllPersonas(): Promise<Persona[]>;

  /** 根据 ID 获取单个分身。不存在返回 null。 */
  getPersonaById(id: string): Promise<Persona | null>;

  /** 删除分身及其关联的会话和消息。不存在的 id 不抛异常。 */
  deletePersona(id: string): Promise<void>;

  // ── 会话（Conversation）──

  /**
   * 创建新会话。
   * @param personaId 关联的分身 ID
   * @param title 标题（默认 "新对话"）
   * @throws InvalidArgumentError personaId 为空
   */
  createConversation(personaId: string, title?: string): Promise<ConversationRow>;

  /** 根据 ID 获取会话。不存在返回 null。 */
  getConversationById(id: string): Promise<ConversationRow | null>;

  /** 获取所有会话，按 updated_at 倒序。 */
  getAllConversations(): Promise<ConversationRow[]>;

  /** 更新会话时间戳。不存在则不操作。 */
  updateConversationTimestamp(conversationId: string): Promise<void>;

  /**
   * 删除会话及其关联消息。
   * @param id 会话 ID
   */
  deleteConversation(id: string): Promise<void>;

  /**
   * 更新会话标题。
   * @param id 会话 ID
   * @param title 新标题
   */
  updateConversationTitle(id: string, title: string): Promise<void>;

  // ── 消息（Message）──

  /**
   * 插入一条消息。
   * @throws InvalidArgumentError role 不是 "user" 或 "persona"
   */
  insertMessage(
    conversationId: string,
    role: "user" | "persona",
    textContent: string,
    stickerId?: string,
  ): Promise<void>;

  /**
   * 获取指定会话的最新消息。
   * @param limit 最大条数（<=0 时使用默认值 1）
   * 返回按时间正序排列的消息。
   */
  getLatestMessages(conversationId: string, limit: number): Promise<MessageRow[]>;

  // ── 表情包（Sticker）──

  /** 插入一条表情包记录 */
  insertSticker(params: {
    filePath: string;
    label?: string;
    embedding?: string;
  }): Promise<StickerRow>;

  /** 获取所有表情包 */
  getAllStickers(): Promise<StickerRow[]>;

  /** 删除指定表情包 */
  deleteStickerById(id: string): Promise<void>;

  // ─── Memories ───

  /** 获取 Persona 关联的共同记忆。不存在返回空 Memories */
  getMemories(personaId: string): Promise<Memories>;

  /** 保存共同记忆 */
  saveMemories(personaId: string, memories: Memories): Promise<void>;

}