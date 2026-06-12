// =============================================================================
// db.ts — SQLite 数据库初始化和迁移
// 规则 6(最小实现): expo-sqlite 使用动态导入，避免 WASM 依赖在 Web 端被解析
// 规则 7(失败快速): 初始化失败立即抛异常
// =============================================================================

import { Platform } from "react-native";

// ========== Schema（规则 3：无魔法值）==========
const BASE_SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS import_batch (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  total_messages INTEGER NOT NULL,
  ignored_count INTEGER NOT NULL,
  participant_count INTEGER NOT NULL,
  time_span_start TEXT,
  time_span_end TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_record (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES import_batch(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  session_id TEXT,
  type TEXT NOT NULL DEFAULT 'text'
);

CREATE INDEX IF NOT EXISTS idx_chat_record_sender ON chat_record(sender_name);
CREATE INDEX IF NOT EXISTS idx_chat_record_session ON chat_record(session_id);

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

/** SQLite 数据库实例 */
let db: any = null;

/** 是否正在初始化中（防止并发） */
let initializing = false;

async function addColumnIfMissing(
  database: any,
  tableName: string,
  columnName: string,
  ddl: string,
): Promise<void> {
  const cols = await database.getAllAsync(`PRAGMA table_info("${tableName}")`);
  if (!cols.some((col: any) => col.name === columnName)) {
    await database.execAsync(ddl);
  }
}

async function migrateSchema(database: any): Promise<void> {
  await addColumnIfMissing(
    database,
    "persona",
    "layers_json",
    "ALTER TABLE persona ADD COLUMN layers_json TEXT DEFAULT '{}'",
  );
  await addColumnIfMissing(
    database,
    "persona",
    "corrections_json",
    "ALTER TABLE persona ADD COLUMN corrections_json TEXT DEFAULT '[]'",
  );
}

/**
 * 获取 SQLite 数据库实例（动态导入 expo-sqlite，避免 Web 端 WASM 错误）。
 * Web 端调用此函数会抛出错误，调用方应捕获并降级。
 */
export async function getDatabase(): Promise<any> {
  if (db) return db;
  if (initializing) {
    // 等待并发初始化完成
    while (initializing) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (db) return db;
  }

  // 规则 6: 动态导入避免 Metro 在 Web 端解析 WASM
  initializing = true;
  try {
    const SQLite = await import("expo-sqlite");
    db = await SQLite.openDatabaseAsync("chat.db");
    await db.execAsync(BASE_SCHEMA);
    await migrateSchema(db);
  } catch (err) {
    console.error("[db.ts] SQLite 初始化失败:", err);
    throw err;
  } finally {
    initializing = false;
  }

  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    try {
      await db.closeAsync();
    } catch (err) {
      console.warn("[db.ts] 关闭数据库失败:", err);
    }
    db = null;
  }
}
