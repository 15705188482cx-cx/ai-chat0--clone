import { getDatabase } from "../db";
import { isWeb, addMessageToMemory, getMessagesFromMemory, getLatestMessagesFromMemory, getMemoryDB } from "../memoryFallback";
import { nanoid } from "nanoid";

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "persona";
  text_content: string;
  sticker_id: string | null;
  created_at: string;
}

export async function insertMessage(params: {
  conversationId: string;
  role: "user" | "persona";
  textContent: string;
  stickerId?: string | null;
}): Promise<MessageRow> {
  const id = nanoid();
  const createdAt = new Date().toISOString();

  if (isWeb()) {
    const msg = {
      id,
      conversation_id: params.conversationId,
      role: params.role,
      text_content: params.textContent,
      sticker_id: params.stickerId ?? null,
      created_at: createdAt,
    };
    addMessageToMemory(msg);
    const mm = getMemoryDB();
    if (mm.conversations.has(params.conversationId)) {
      const conv = mm.conversations.get(params.conversationId);
      if (conv) conv.updated_at = createdAt;
    }
    return msg;
  }

  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO message (id, conversation_id, role, text_content, sticker_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [id, params.conversationId, params.role, params.textContent, params.stickerId ?? null, createdAt],
  );

  // 更新会话的 updated_at
  await db.runAsync(
    "UPDATE conversation SET updated_at = ? WHERE id = ?",
    [createdAt, params.conversationId],
  );

  return {
    id,
    conversation_id: params.conversationId,
    role: params.role,
    text_content: params.textContent,
    sticker_id: params.stickerId ?? null,
    created_at: createdAt,
  };
}

export async function getMessagesByConversation(
  conversationId: string,
  limit = 50,
  offset = 0,
): Promise<MessageRow[]> {
  if (isWeb()) {
    const all = getMessagesFromMemory(conversationId, limit + offset);
    return all.slice(offset, offset + limit);
  }

  const db = await getDatabase();
  return db.getAllAsync<MessageRow>(
    "SELECT * FROM message WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?",
    [conversationId, limit, offset],
  );
}

export async function getLatestMessages(
  conversationId: string,
  limit = 20,
): Promise<MessageRow[]> {
  if (isWeb()) {
    return getLatestMessagesFromMemory(conversationId, limit);
  }

  const db = await getDatabase();
  return db.getAllAsync<MessageRow>(
    "SELECT * FROM message WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?",
    [conversationId, limit],
  );
}

export async function deleteByConversationId(conversationId: string): Promise<void> {
  if (isWeb()) {
    getMemoryDB().messages.delete(conversationId);
    return;
  }
  const db = await getDatabase();
  await db.runAsync("DELETE FROM message WHERE conversation_id = ?", [conversationId]);
}