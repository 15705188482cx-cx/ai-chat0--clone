// =============================================================================
// NativeStore — IDataStore 的 Native (expo-sqlite) 实现
// 规则 1(契约优先): 实现 IDataStore 所有方法
// 规则 2(不变式断言): 前置条件检查
// 规则 4(显式错误): 使用 IDataStore 定义的 Error 子类
// =============================================================================

import { nanoid } from "nanoid";
import type { Persona } from "../persona/types";
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
} from "./IDataStore";

// ========== Schema 常量（规则 3：无魔法值）==========
const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS chat_record (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  session_id TEXT,
  type TEXT NOT NULL DEFAULT 'text'
);

CREATE INDEX IF NOT EXISTS idx_chat_record_sender ON chat_record(sender_name);

CREATE TABLE IF NOT EXISTS persona (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_sender TEXT NOT NULL,
  chat_sample_ids TEXT,
  style_summary TEXT,
  layers_json TEXT DEFAULT '{}',
  corrections_json TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversation (
  id TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL REFERENCES persona(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '新对话',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS message (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'persona')),
  text_content TEXT NOT NULL,
  sticker_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sticker (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  label TEXT,
  embedding TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

/** 批量插入每批次条数 */
const BULK_INSERT_BATCH_SIZE = 50;

/** 迁移 — 添加可能缺失的列 */
async function runMigrations(database: any): Promise<void> {
  const addColIfMissing = async (
    table: string,
    col: string,
    ddl: string,
  ) => {
    const cols = await database.getAllAsync<{ name: string }>(
      `PRAGMA table_info("${table}")`,
    );
    if (!cols.some((c: { name: string }) => c.name === col)) {
      await database.execAsync(ddl);
    }
  };
  await addColIfMissing(
    "persona",
    "layers_json",
    "ALTER TABLE persona ADD COLUMN layers_json TEXT DEFAULT '{}'",
  );
  await addColIfMissing(
    "persona",
    "corrections_json",
    "ALTER TABLE persona ADD COLUMN corrections_json TEXT DEFAULT '[]'",
  );
}

/**
 * NativeStore — 使用 expo-sqlite 实现 IDataStore。
 * 适用于 Android/iOS 原生环境。
 */
export class NativeStore implements IDataStore {
  private db: any | null = null;
  private initialized = false;
  private _sqliteModule: any = null;

  async init(): Promise<void> {
    if (this.initialized && this.db) return;
    try {
      const sqlite = await this.getSQLite();
      this.db = await sqlite.openDatabaseAsync("chat.db");
      await this.db.execAsync(SCHEMA_SQL);
      await runMigrations(this.db);
      this.initialized = true;
    } catch (err) {
      console.error("[NativeStore] SQLite 初始化失败:", err);
      throw new Error(
        "[NativeStore] 数据库初始化失败: " +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  }

  private assertReady(): void {
    if (!this.initialized || !this.db) {
      throw new StoreNotReadyError("NativeStore");
    }
  }

  // ── 聊天记录 ──

  async getChatRecordCount(): Promise<number> {
    this.assertReady();
    const row = await this.db!.getFirstAsync<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM chat_record",
    );
    return row?.cnt ?? 0;
  }

  async getDistinctSenders(): Promise<string[]> {
    this.assertReady();
    const rows = await this.db!.getAllAsync<{ sender_name: string }>(
      "SELECT DISTINCT sender_name FROM chat_record ORDER BY sender_name",
    );
    return rows.map((r: { sender_name: string }) => r.sender_name);
  }

  async getSamplesBySender(
    senderName: string,
    limit: number,
  ): Promise<ChatRecordRow[]> {
    this.assertReady();
    if (!senderName || senderName.trim().length === 0) return [];
    const safeLimit = Math.max(1, limit);
    return this.db!.getAllAsync<ChatRecordRow>(
      "SELECT * FROM chat_record WHERE sender_name = ? ORDER BY RANDOM() LIMIT ?",
      [senderName, safeLimit],
    );
  }

  async bulkInsertChatRecords(
    records: Omit<ChatRecordRow, "id">[],
  ): Promise<number> {
    this.assertReady();
    if (!records || records.length === 0) return 0;

    let count = 0;
    for (let i = 0; i < records.length; i += BULK_INSERT_BATCH_SIZE) {
      const batch = records.slice(i, i + BULK_INSERT_BATCH_SIZE);
      const placeholders = batch.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");
      const params: unknown[] = [];
      for (const r of batch) {
        params.push(
          nanoid(),
          r.batch_id,
          r.sender_name,
          r.content,
          r.timestamp,
          r.session_id ?? null,
          r.type,
        );
      }
      await this.db!.runAsync(
        `INSERT INTO chat_record (id, batch_id, sender_name, content, timestamp, session_id, type) VALUES ${placeholders}`,
        params,
      );
      count += batch.length;
    }
    return count;
  }

  async clearChatRecords(): Promise<void> {
    this.assertReady();
    await this.db!.runAsync("DELETE FROM chat_record");
  }

  async getConversationPairs(
    personAName: string,
    personBName: string,
    pairCount = 10,
  ): Promise<string[]> {
    this.assertReady();
    const rows = await this.db!.getAllAsync<ChatRecordRow>(
      `SELECT * FROM chat_record
       WHERE type = 'text'
         AND (sender_name = ? OR sender_name = ?)
       ORDER BY timestamp ASC`,
      [personAName, personBName],
    );

    const pairs: string[] = [];
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const curr = rows[i];
      if (prev.sender_name === personAName && curr.sender_name === personBName) {
        pairs.push(
          `${personAName}: ${prev.content}\n${personBName}: ${curr.content}`,
        );
      }
    }
    return pairs.slice(-pairCount);
  }

  // ── Persona ──

  async savePersona(persona: Persona): Promise<void> {
    this.assertReady();
    if (!persona.id) {
      throw new InvalidArgumentError("savePersona", "persona.id 不能为空");
    }
    if (!persona.name) {
      throw new InvalidArgumentError("savePersona", "persona.name 不能为空");
    }
    await this.db!.runAsync(
      `INSERT OR REPLACE INTO persona (id, name, source_sender, chat_sample_ids, style_summary, layers_json, corrections_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        persona.id,
        persona.name,
        persona.sourceSender,
        JSON.stringify(persona.chatSampleIds || []),
        persona.styleSummary || "",
        JSON.stringify(persona.layers || {}),
        JSON.stringify(persona.corrections || []),
      ],
    );
  }

  async getAllPersonas(): Promise<Persona[]> {
    this.assertReady();
    const rows = await this.db!.getAllAsync<any>(
      "SELECT * FROM persona ORDER BY created_at DESC",
    );
    return rows.map((r: any) => this.parsePersonaRow(r));
  }

  async getPersonaById(id: string): Promise<Persona | null> {
    this.assertReady();
    const row = await this.db!.getFirstAsync<any>(
      "SELECT * FROM persona WHERE id = ?",
      [id],
    );
    return row ? this.parsePersonaRow(row) : null;
  }

  async deletePersona(id: string): Promise<void> {
    this.assertReady();
    await this.db!.runAsync("DELETE FROM persona WHERE id = ?", [id]);
  }

  // ── 会话 ──

  async createConversation(
    personaId: string,
    title?: string,
  ): Promise<ConversationRow> {
    this.assertReady();
    if (!personaId) {
      throw new InvalidArgumentError("createConversation", "personaId 不能为空");
    }
    const id = nanoid();
    const now = new Date().toISOString();
    const safeTitle = title || "新对话";
    await this.db!.runAsync(
      "INSERT INTO conversation (id, persona_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      [id, personaId, safeTitle, now, now],
    );
    return {
      id,
      persona_id: personaId,
      title: safeTitle,
      created_at: now,
      updated_at: now,
    };
  }

  async getConversationById(id: string): Promise<ConversationRow | null> {
    this.assertReady();
    if (!id) return null;
    return this.db!.getFirstAsync<ConversationRow>(
      "SELECT * FROM conversation WHERE id = ?",
      [id],
    );
  }

  async getAllConversations(): Promise<ConversationRow[]> {
    this.assertReady();
    return this.db!.getAllAsync<ConversationRow>(
      "SELECT * FROM conversation ORDER BY updated_at DESC",
    );
  }

  async updateConversationTimestamp(conversationId: string): Promise<void> {
    this.assertReady();
    const now = new Date().toISOString();
    await this.db!.runAsync(
      "UPDATE conversation SET updated_at = ? WHERE id = ?",
      [now, conversationId],
    );
  }

  async deleteConversation(id: string): Promise<void> {
    this.assertReady();
    await this.db!.runAsync("DELETE FROM conversation WHERE id = ?", [id]);
  }

  async updateConversationTitle(id: string, title: string): Promise<void> {
    this.assertReady();
    const now = new Date().toISOString();
    await this.db!.runAsync(
      "UPDATE conversation SET title = ?, updated_at = ? WHERE id = ?",
      [title, now, id],
    );
  }

  // ── 消息 ──

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
    await this.db!.runAsync(
      "INSERT INTO message (id, conversation_id, role, text_content, sticker_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [
        nanoid(),
        conversationId,
        role,
        textContent,
        stickerId || null,
        new Date().toISOString(),
      ],
    );
  }

  async getLatestMessages(
    conversationId: string,
    limit: number,
  ): Promise<MessageRow[]> {
    this.assertReady();
    const safeLimit = Math.max(1, limit);
    return this.db!.getAllAsync<MessageRow>(
      "SELECT * FROM message WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?",
      [conversationId, safeLimit],
    );
  }

  // ── 表情包 ──

  async insertSticker(params: {
    filePath: string;
    label?: string;
    embedding?: string;
  }): Promise<StickerRow> {
    this.assertReady();
    const id = nanoid();
    const now = new Date().toISOString();
    await this.db!.runAsync(
      "INSERT INTO sticker (id, file_path, label, embedding, imported_at) VALUES (?, ?, ?, ?, ?)",
      [id, params.filePath, params.label || null, params.embedding || null, now],
    );
    return {
      id,
      file_path: params.filePath,
      label: params.label || null,
      embedding: params.embedding || null,
      imported_at: now,
    };
  }

  async getAllStickers(): Promise<StickerRow[]> {
    this.assertReady();
    return this.db!.getAllAsync<StickerRow>(
      "SELECT * FROM sticker ORDER BY imported_at DESC",
    );
  }

  async deleteStickerById(id: string): Promise<void> {
    this.assertReady();
    await this.db!.runAsync("DELETE FROM sticker WHERE id = ?", [id]);
  }

  // ==================== 内部帮助方法 ====================

  /** 动态获取 expo-sqlite 模块 */
  private async getSQLite() {
    if (this._sqliteModule) return this._sqliteModule;
    this._sqliteModule = await import("expo-sqlite");
    return this._sqliteModule;
  }

  private parsePersonaRow(row: any): Persona {
    let layers: Persona["layers"];
    let corrections: Persona["corrections"];
    try {
      const parsed = JSON.parse(row.layers_json || "{}");
      layers = Object.keys(parsed).length > 0 ? parsed : undefined;
    } catch {
      layers = undefined;
    }
    try {
      const parsed = JSON.parse(row.corrections_json || "[]");
      corrections = parsed.length > 0 ? parsed : undefined;
    } catch {
      corrections = undefined;
    }
    return {
      id: row.id,
      name: row.name,
      sourceSender: row.source_sender,
      chatSampleIds: JSON.parse(row.chat_sample_ids || "[]"),
      styleSummary: row.style_summary || "",
      ...(layers ? { layers } : {}),
      ...(corrections ? { corrections } : {}),
      createdAt: row.created_at,
    };
  }
}
