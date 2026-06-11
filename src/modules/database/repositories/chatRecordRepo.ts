import { getDatabase } from "../db";
import { isWeb, getMemoryConversationPairs } from "../memoryFallback";
import { getMemoryDB } from "../memoryFallback";
import { nanoid } from "nanoid";
import type { RawMessage } from "../../chatParser/types";

export interface ChatRecordRow {
  id: string;
  batch_id: string;
  sender_name: string;
  content: string;
  timestamp: string;
  session_id: string | null;
  type: string;
}

export async function bulkInsert(
  records: Omit<ChatRecordRow, "id">[],
): Promise<number> {
  const db = await getDatabase();
  let count = 0;

  // 分批写入，每批 50 条，避免 Web/IndexedDB 超时
  const BATCH = 50;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const placeholders = batch.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");
    const values: string[] = [];
    for (const r of batch) {
      values.push(nanoid(), r.batch_id, r.sender_name, r.content, r.timestamp, r.session_id ?? "", r.type);
    }
    try {
      await db.runAsync(
        `INSERT INTO chat_record (id, batch_id, sender_name, content, timestamp, session_id, type) VALUES ${placeholders}`,
        values,
      );
    } catch {
      // 如果批量 INSERT 不支持（旧版 SQLite），回退逐条
      for (const r of batch) {
        await db.runAsync(
          `INSERT INTO chat_record (id, batch_id, sender_name, content, timestamp, session_id, type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [nanoid(), r.batch_id, r.sender_name, r.content, r.timestamp, r.session_id ?? "", r.type],
        );
      }
    }
    count += batch.length;
  }
  return count;
}

/**
 * 从解析后的 RawMessage 数组批量写入
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

export async function getBySender(
  senderName: string,
  limit = 100,
): Promise<ChatRecordRow[]> {
  if (isWeb()) {
    return getMemoryDB().chatRecords.filter(r => r.sender_name === senderName).slice(-limit);
  }
  const db = await getDatabase();
  return db.getAllAsync<ChatRecordRow>(
    "SELECT * FROM chat_record WHERE sender_name = ? ORDER BY timestamp DESC LIMIT ?",
    [senderName, limit],
  );
}

/**
 * 获取指定发送者的随机对话样本，用于 Few-shot Prompt
 */
export async function getSampleBySender(
  senderName: string,
  limit = 20,
): Promise<ChatRecordRow[]> {
  if (isWeb()) {
    const all = getMemoryDB().chatRecords.filter(r => r.sender_name === senderName);
    return all.sort(() => Math.random() - 0.5).slice(0, limit);
  }
  const db = await getDatabase();
  return db.getAllAsync<ChatRecordRow>(
    "SELECT * FROM chat_record WHERE sender_name = ? ORDER BY RANDOM() LIMIT ?",
    [senderName, limit],
  );
}

export async function getByBatchId(batchId: string): Promise<ChatRecordRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<ChatRecordRow>(
    "SELECT * FROM chat_record WHERE batch_id = ? ORDER BY timestamp ASC",
    [batchId],
  );
}

export async function getDistinctSenders(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ sender_name: string }>(
    "SELECT DISTINCT sender_name FROM chat_record ORDER BY sender_name",
  );
  return rows.map((r) => r.sender_name);
}

export async function getCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM chat_record",
  );
  return row?.cnt ?? 0;
}

/**
 * 获取对话对样本 — 提取"我说了什么 → 她怎么回复"的相邻消息对，
 * 用于 Few-shot Prompt 让 AI 学习她的响应模式。
 */
export async function getConversationPairs(
  herName: string,
  myName = '\u6211',
  pairCount = 10,
): Promise<string[]> {
  if (isWeb()) {
    return getMemoryConversationPairs(herName, myName, pairCount);
  }

  const db = await getDatabase();
  const rows = await db.getAllAsync<ChatRecordRow>(
    'SELECT * FROM chat_record WHERE sender_name IN (?, ?) AND type = \'text\' ORDER BY timestamp ASC LIMIT 500',
    [herName, myName],
  );

  const pairs: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const curr = rows[i];
    if (prev.sender_name === myName && curr.sender_name === herName) {
      pairs.push(myName + ': ' + prev.content + '\n' + herName + ': ' + curr.content);
    }
  }
  return pairs.slice(-pairCount);
}

