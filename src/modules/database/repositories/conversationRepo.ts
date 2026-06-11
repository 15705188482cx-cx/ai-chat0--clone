import { getDatabase } from "../db";
import { isWeb, addConversationToMemory, getConversationFromMemory, getAllConversationsFromMemory, updateConversationInMemory } from "../memoryFallback";
import { nanoid } from "nanoid";

export interface ConversationRow {
  id: string;
  persona_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export async function createConversation(personaId: string, title?: string): Promise<ConversationRow> {
  const id = nanoid();
  const now = new Date().toISOString();

  if (isWeb()) {
    const conv = { id, persona_id: personaId, title: title ?? "\u65B0\u5BF9\u8BDD", created_at: now, updated_at: now };
    addConversationToMemory(conv);
    return conv;
  }

  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO conversation (id, persona_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    [id, personaId, title ?? "\u65B0\u5BF9\u8BDD", now, now],
  );

  return { id, persona_id: personaId, title: title ?? "\u65B0\u5BF9\u8BDD", created_at: now, updated_at: now };
}
export async function getAllConversations(): Promise<ConversationRow[]> {
  if (isWeb()) {
    return getAllConversationsFromMemory().sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  const db = await getDatabase();
  return db.getAllAsync<ConversationRow>(
    "SELECT * FROM conversation ORDER BY updated_at DESC",
  );
}

export async function getConversationById(id: string): Promise<ConversationRow | null> {
  if (isWeb()) {
    return getConversationFromMemory(id) || null;
  }
  const db = await getDatabase();
  return db.getFirstAsync<ConversationRow>(
    "SELECT * FROM conversation WHERE id = ?",
    [id],
  );
}

export async function deleteConversation(id: string): Promise<void> {
  if (isWeb()) {
    const existing = getConversationFromMemory(id);
    if (existing) {
      const mm = await import("../memoryFallback");
      mm.getMemoryDB().conversations.delete(id);
      mm.getMemoryDB().messages.delete(id);
    }
    return;
  }
  const db = await getDatabase();
  // 外键级联会删除关联的 message
  await db.runAsync("DELETE FROM conversation WHERE id = ?", [id]);
}

export async function updateConversationTitle(id: string, title: string): Promise<void> {
  if (isWeb()) {
    updateConversationInMemory(id, { title, updated_at: new Date().toISOString() });
    return;
  }
  const db = await getDatabase();
  await db.runAsync("UPDATE conversation SET title = ? WHERE id = ?", [title, id]);
}
