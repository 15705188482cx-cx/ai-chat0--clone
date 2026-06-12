import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

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

async function addColumnIfMissing(
  database: SQLite.SQLiteDatabase,
  tableName: string,
  columnName: string,
  ddl: string,
): Promise<void> {
  const cols = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`);
  if (!cols.some((col) => col.name === columnName)) {
    await database.execAsync(ddl);
  }
}

async function migrateSchema(database: SQLite.SQLiteDatabase): Promise<void> {
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

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync("chat.db");
    await db.execAsync(BASE_SCHEMA);
    await migrateSchema(db);
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
