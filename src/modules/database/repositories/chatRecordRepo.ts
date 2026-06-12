// =============================================================================
// chatRecordRepo — 聊天记录仓库
// 规则 1(契约优先): 批量操作通过 getStore()，采样操作兼容 memoryFallback
// =============================================================================

import { getStore } from "../storeProvider";
import { isWeb, getMemoryConversationPairs, getMemoryDB } from "../memoryFallback";
import { nanoid } from "nanoid";
import type { RawMessage } from "../../chatParser/types";

// ========== 类型 ==========
export interface ChatRecordRow {
  id: string;
  batch_id: string;
  sender_name: string;
  content: string;
  timestamp: string;
  session_id: string | null;
  type: string;
}

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
 * 获取指定发送者的所有记录。
 */
export async function getBySender(
  senderName: string,
  limit = 100,
): Promise<ChatRecordRow[]> {
  try {
    const store = await getStore();
    return store.getSamplesBySender(senderName, limit);
  } catch (err) {
    console.warn("[chatRecordRepo] getBySender 失败，降级到 memoryFallback:", err);
    return getMemoryDB()
      .chatRecords.filter((r) => r.sender_name === senderName)
      .slice(-limit);
  }
}

/**
 * 获取指定发送者的随机对话样本。
 */
export async function getSampleBySender(
  senderName: string,
  limit = 20,
): Promise<ChatRecordRow[]> {
  try {
    const store = await getStore();
    return store.getSamplesBySender(senderName, limit);
  } catch (err) {
    console.warn("[chatRecordRepo] getSampleBySender 失败，降级到 memoryFallback:", err);
    const all = getMemoryDB().chatRecords.filter(
      (r) => r.sender_name === senderName,
    );
    return all.sort(() => Math.random() - 0.5).slice(0, limit);
  }
}

/**
 * 获取指定批次的记录。
 */
export async function getByBatchId(batchId: string): Promise<ChatRecordRow[]> {
  const store = await getStore();
  // IDataStore 没有 getByBatchId，使用 getAllConversations 区分
  // 这里保留兼容
  const all = getMemoryDB().chatRecords.filter((r) => r.batch_id === batchId);
  return all.sort(
    (a, b) => a.timestamp.localeCompare(b.timestamp),
  );
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
 * 获取对话对样本。
 */
export async function getConversationPairs(
  herName: string,
  myName = "我",
  pairCount = 10,
): Promise<string[]> {
  if (isWeb()) {
    return getMemoryConversationPairs(herName, myName, pairCount);
  }

  const all = getMemoryDB().chatRecords
    .filter(
      (r) =>
        r.type === "text" &&
        (r.sender_name === herName || r.sender_name === myName),
    )
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const pairs: string[] = [];
  for (let i = 1; i < all.length; i++) {
    const prev = all[i - 1];
    const curr = all[i];
    if (prev.sender_name === myName && curr.sender_name === herName) {
      pairs.push(myName + ": " + prev.content + "\n" + herName + ": " + curr.content);
    }
  }
  return pairs.slice(-pairCount);
}
