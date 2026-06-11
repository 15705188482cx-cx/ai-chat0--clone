/**
 * Web 端内存 fallback 存储。
 * 用于替代 expo-sqlite，当 DB 不可用时自动切换。
 * 数据仅在内存中，刷新页面即消失。
 */

import { Platform } from "react-native";
import type { RawMessage } from "../chatParser/types";
import type { Persona } from "../persona/types";

// ======= 聊天记录存储（已有） =======

interface MemoryDB {
  chatRecords: Array<{
    id: string;
    batch_id: string;
    sender_name: string;
    content: string;
    timestamp: string;
    session_id: string | null;
    type: string;
  }>;
  personas: Map<string, Persona>;
  conversations: Map<string, {
    id: string;
    persona_id: string;
    title: string;
    created_at: string;
    updated_at: string;
  }>;
  messages: Map<string, Array<{
    id: string;
    conversation_id: string;
    role: "user" | "persona";
    text_content: string;
    sticker_id: string | null;
    created_at: string;
  }>>;
}

let memoryDB: MemoryDB = {
  chatRecords: [],
  personas: new Map(),
  conversations: new Map(),
  messages: new Map(),
};

export function isWeb(): boolean {
  return Platform.OS === "web";
}

export function getMemoryDB(): MemoryDB {
  return memoryDB;
}

export function resetMemoryDB(): void {
  memoryDB = { chatRecords: [], personas: new Map(), conversations: new Map(), messages: new Map() };
}

export function addRecordsToMemory(records: Array<{ id: string; sender: string; content: string; timestamp: Date; type: string }>): void {
  const batchId = "web-batch";
  for (const r of records) {
    memoryDB.chatRecords.push({
      id: r.id,
      batch_id: batchId,
      sender_name: r.sender,
      content: r.content,
      timestamp: r.timestamp.toISOString(),
      session_id: null,
      type: r.type,
    });
  }
}

export function getMemoryDistinctSenders(): string[] {
  return [...new Set(memoryDB.chatRecords.map((r) => r.sender_name))];
}

export function getMemoryCount(): number {
  return memoryDB.chatRecords.length;
}

export function getMemorySamplesBySender(senderName: string, limit = 20): string[] {
  return memoryDB.chatRecords
    .filter((r) => r.sender_name === senderName)
    .sort(() => Math.random() - 0.5)
    .slice(0, limit)
    .map((r) => r.content);
}

// ======= Web 端 Persona 存储 =======

export function addPersonaToMemory(persona: Persona): void {
  memoryDB.personas.set(persona.id, persona);
}

export function getPersonaFromMemory(id: string): Persona | undefined {
  return memoryDB.personas.get(id);
}

export function getAllPersonasFromMemory(): Persona[] {
  return Array.from(memoryDB.personas.values());
}

export function deletePersonaFromMemory(id: string): void {
  memoryDB.personas.delete(id);
}

// ======= Web 端 Conversation 存储 =======

export function addConversationToMemory(conv: {
  id: string;
  persona_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}): void {
  memoryDB.conversations.set(conv.id, conv);
}

export function getConversationFromMemory(id: string) {
  return memoryDB.conversations.get(id);
}

export function getAllConversationsFromMemory() {
  return Array.from(memoryDB.conversations.values());
}

export function updateConversationInMemory(id: string, updates: Partial<{ title: string; updated_at: string }>): void {
  const existing = memoryDB.conversations.get(id);
  if (existing) {
    Object.assign(existing, updates);
  }
}

// ======= Web 端 Message 存储 =======

export function addMessageToMemory(msg: {
  id: string;
  conversation_id: string;
  role: "user" | "persona";
  text_content: string;
  sticker_id: string | null;
  created_at: string;
}): void {
  const existing = memoryDB.messages.get(msg.conversation_id) || [];
  existing.push(msg);
  memoryDB.messages.set(msg.conversation_id, existing);
  // 更新会话时间
  const conv = memoryDB.conversations.get(msg.conversation_id);
  if (conv) conv.updated_at = msg.created_at;
}

export function getMessagesFromMemory(conversationId: string, limit = 50) {
  const msgs = memoryDB.messages.get(conversationId) || [];
  return msgs.slice(-limit);
}

export function getLatestMessagesFromMemory(conversationId: string, limit = 20) {
  const msgs = memoryDB.messages.get(conversationId) || [];
  return msgs.slice(-limit).reverse();
}

/** Web 端对话对提取 — 从内存 chatRecords 中提取"我说→她回"的相邻对 */
export function getMemoryConversationPairs(herName: string, myName = "我", pairCount = 10): string[] {
  const records = memoryDB.chatRecords
    .filter((r) => r.type === "text" && (r.sender_name === herName || r.sender_name === myName))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const pairs: string[] = [];
  for (let i = 1; i < records.length; i++) {
    const prev = records[i - 1];
    const curr = records[i];
    if (prev.sender_name === myName && curr.sender_name === herName) {
      pairs.push(`${myName}: ${prev.content}\n${herName}: ${curr.content}`);
    }
  }
  return pairs.slice(-pairCount);
}

