import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

async function migrateSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    // 检查 persona 表是否已有 layers_json 列
    const cols = await database.getAllAsync<{ name: string }>(
      "PRAGMA table_info(persona)"
    );
    const colNames = cols.map((c: any) => c.name);

    const migrationSteps: string[] = [];
    if (!colNames.includes("layers_json")) {
      migrationSteps.push("ALTER TABLE persona ADD COLUMN layers_json TEXT DEFAULT '{}'");
    }
    if (!colNames.includes("corrections_json")) {
      migrationSteps.push("ALTER TABLE persona ADD COLUMN corrections_json TEXT DEFAULT '[]'");
    }

    for (const sql of migrationSteps) {
      await database.execAsync(sql);
    }

    if (migrationSteps.length > 0) {
      console.log(`[DB] 已执行 ${migrationSteps.length} 条迁移`);
    }
  } catch (e) {
    console.warn("[DB] 迁移失败（首次启动可忽略）", e);
  }
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync("chat.db");
    await db.execAsync("PRAGMA foreign_keys = ON;");
    await db.execAsync("PRAGMA journal_mode = WAL;");
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
