/**
 * Web 端持久化 fallback 存储。
 * 用于替代 expo-sqlite 的开发/预览环境，数据保存在 localStorage。
 */

import { Platform } from "react-native";
import type { Persona } from "../persona/types";

interface MemoryConversation {
  id: string;
  persona_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface MemoryMessage {
  id: string;
  conversation_id: string;
  role: "user" | "persona";
  text_content: string;
  sticker_id: string | null;
  created_at: string;
}

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
  conversations: Map<string, MemoryConversation>;
  messages: Map<string, MemoryMessage[]>;
}

interface SerializedMemoryDB {
  chatRecords: MemoryDB["chatRecords"];
  personas: Persona[];
  conversations: MemoryConversation[];
  messages: Array<[string, MemoryMessage[]]>;
}

const STORAGE_KEY = "AI_CHAT_CLONE_WEB_DB_V1";

let memoryDB: MemoryDB = createEmptyMemoryDB();
let hasHydrated = false;

function createEmptyMemoryDB(): MemoryDB {
  return {
    chatRecords: [],
    personas: new Map(),
    conversations: new Map(),
    messages: new Map(),
  };
}

function canUseLocalStorage(): boolean {
  return Platform.OS === "web" && typeof globalThis !== "undefined" && "localStorage" in globalThis;
}

function serialize(db: MemoryDB): SerializedMemoryDB {
  return {
    chatRecords: db.chatRecords,
    personas: Array.from(db.personas.values()),
    conversations: Array.from(db.conversations.values()),
    messages: Array.from(db.messages.entries()),
  };
}

function deserialize(raw: SerializedMemoryDB): MemoryDB {
  return {
    chatRecords: Array.isArray(raw.chatRecords) ? raw.chatRecords : [],
    personas: new Map((raw.personas || []).map((persona) => [persona.id, persona])),
    conversations: new Map((raw.conversations || []).map((conversation) => [conversation.id, conversation])),
    messages: new Map(raw.messages || []),
  };
}

function hydrateMemoryDB(): void {
  if (hasHydrated) return;
  hasHydrated = true;
  if (!canUseLocalStorage()) return;

  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    memoryDB = deserialize(JSON.parse(raw));
  } catch {
    memoryDB = createEmptyMemoryDB();
  }
}

function persistMemoryDB(): void {
  if (!canUseLocalStorage()) return;
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(memoryDB)));
  } catch {
    // localStorage quota errors should not crash the app.
  }
}

export function isWeb(): boolean {
  return Platform.OS === "web";
}

export function getMemoryDB(): MemoryDB {
  hydrateMemoryDB();
  return memoryDB;
}

export function resetMemoryDB(): void {
  memoryDB = createEmptyMemoryDB();
  hasHydrated = true;
  if (canUseLocalStorage()) {
    globalThis.localStorage.removeItem(STORAGE_KEY);
  }
}

export function addRecordsToMemory(records: Array<{ id: string; sender: string; content: string; timestamp: Date; type: string }>): void {
  hydrateMemoryDB();
  const batchId = "web-batch-" + Date.now();
  for (const record of records) {
    memoryDB.chatRecords.push({
      id: record.id,
      batch_id: batchId,
      sender_name: record.sender,
      content: record.content,
      timestamp: record.timestamp.toISOString(),
      session_id: null,
      type: record.type,
    });
  }
  persistMemoryDB();
}

export function getMemoryDistinctSenders(): string[] {
  hydrateMemoryDB();
  return [...new Set(memoryDB.chatRecords.map((record) => record.sender_name))];
}

export function getMemoryCount(): number {
  hydrateMemoryDB();
  return memoryDB.chatRecords.length;
}

export function getMemorySamplesBySender(senderName: string, limit = 20): string[] {
  hydrateMemoryDB();
  return memoryDB.chatRecords
    .filter((record) => record.sender_name === senderName)
    .sort(() => Math.random() - 0.5)
    .slice(0, limit)
    .map((record) => record.content);
}

export function addPersonaToMemory(persona: Persona): void {
  hydrateMemoryDB();
  memoryDB.personas.set(persona.id, persona);
  persistMemoryDB();
}

export function getPersonaFromMemory(id: string): Persona | undefined {
  hydrateMemoryDB();
  return memoryDB.personas.get(id);
}

export function getAllPersonasFromMemory(): Persona[] {
  hydrateMemoryDB();
  return Array.from(memoryDB.personas.values());
}

export function deletePersonaFromMemory(id: string): void {
  hydrateMemoryDB();
  memoryDB.personas.delete(id);
  for (const conversation of Array.from(memoryDB.conversations.values())) {
    if (conversation.persona_id === id) {
      memoryDB.conversations.delete(conversation.id);
      memoryDB.messages.delete(conversation.id);
    }
  }
  persistMemoryDB();
}

export function addConversationToMemory(conversation: MemoryConversation): void {
  hydrateMemoryDB();
  memoryDB.conversations.set(conversation.id, conversation);
  persistMemoryDB();
}

export function getConversationFromMemory(id: string): MemoryConversation | undefined {
  hydrateMemoryDB();
  return memoryDB.conversations.get(id);
}

export function getAllConversationsFromMemory(): MemoryConversation[] {
  hydrateMemoryDB();
  return Array.from(memoryDB.conversations.values());
}

export function updateConversationInMemory(id: string, updates: Partial<{ title: string; updated_at: string }>): void {
  hydrateMemoryDB();
  const existing = memoryDB.conversations.get(id);
  if (existing) {
    Object.assign(existing, updates);
    persistMemoryDB();
  }
}

export function addMessageToMemory(message: MemoryMessage): void {
  hydrateMemoryDB();
  const existing = memoryDB.messages.get(message.conversation_id) || [];
  existing.push(message);
  memoryDB.messages.set(message.conversation_id, existing);
  const conversation = memoryDB.conversations.get(message.conversation_id);
  if (conversation) conversation.updated_at = message.created_at;
  persistMemoryDB();
}

export function getMessagesFromMemory(conversationId: string, limit = 50): MemoryMessage[] {
  hydrateMemoryDB();
  const messages = memoryDB.messages.get(conversationId) || [];
  return messages.slice(-limit);
}

export function getLatestMessagesFromMemory(conversationId: string, limit = 20): MemoryMessage[] {
  hydrateMemoryDB();
  const messages = memoryDB.messages.get(conversationId) || [];
  return messages.slice(-limit).reverse();
}

export function getMemoryConversationPairs(herName: string, myName = "我", pairCount = 10): string[] {
  hydrateMemoryDB();
  const records = memoryDB.chatRecords
    .filter((record) => record.type === "text" && (record.sender_name === herName || record.sender_name === myName))
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  const pairs: string[] = [];
  for (let index = 1; index < records.length; index += 1) {
    const previous = records[index - 1];
    const current = records[index];
    if (previous.sender_name === myName && current.sender_name === herName) {
      pairs.push(`${myName}: ${previous.content}\n${herName}: ${current.content}`);
    }
  }
  return pairs.slice(-pairCount);
}
