// =============================================================================
// chatRecordRepo — 聊天记录仓库
// 规则 1(契约优先): 所有操作通过 getStore() 统一访问
// =============================================================================

import { getStore } from "../storeProvider";
import type { ChatRecordRow } from "../IDataStore";
import type { RawMessage } from "../../chatParser/types";

export type { ChatRecordRow };

// ========== 公开方法 ==========

/**
 * 批量插入聊天记录。
 */
export async function bulkInsert(
  records: Omit<ChatRecordRow, "id">[],
): Promise<number> {
  const store = await getStore();
  return store.bulkInsertChatRecords(records);
}

/**
 * 从解析后的 RawMessage 数组批量写入。
 */
export async function bulkInsertFromRawMessages(
  messages: RawMessage[],
  batchId: string,
): Promise<number> {
  return bulkInsert(
    messages.map((m) => ({
      batch_id: batchId,
      sender_name: m.senderName,
      content: m.content,
      timestamp: m.timestamp.toISOString(),
      session_id: null,
      type: m.type,
    })),
  );
}

/**
 * 获取指定发送者的随机样本记录。
 */
export async function getSampleBySender(
  senderName: string,
  limit = 20,
): Promise<ChatRecordRow[]> {
  const store = await getStore();
  return store.getSamplesBySender(senderName, limit);
}

/**
 * 获取不重复的发送者列表。
 */
export async function getDistinctSenders(): Promise<string[]> {
  const store = await getStore();
  return store.getDistinctSenders();
}

/**
 * 获取聊天记录总数。
 */
export async function getCount(): Promise<number> {
  const store = await getStore();
  return store.getChatRecordCount();
}

/**
 * 获取两个参与者的对话对样本。
 */
export async function getConversationPairs(
  personAName: string,
  personBName: string,
  pairCount = 10,
): Promise<string[]> {
  const store = await getStore();
  return store.getConversationPairs(personAName, personBName, pairCount);
}

/**
 * 清空所有聊天记录。
 */
export async function clearAll(): Promise<void> {
  const store = await getStore();
  return store.clearChatRecords();
}
