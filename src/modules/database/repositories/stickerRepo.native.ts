// =============================================================================
// stickerRepo.native.ts — 原生端表情包仓库（使用 expo-sqlite）
// =============================================================================

import { nanoid } from "nanoid";

async function getDb(): Promise<any> {
  const { getDatabase } = await import("../db");
  return getDatabase();
}

export interface StickerRow {
  id: string;
  file_path: string;
  label: string | null;
  embedding: string | null;
  imported_at: string;
}

export async function insertSticker(params: {
  filePath: string;
  label?: string;
  embedding?: string;
}): Promise<StickerRow> {
  const db = await getDb();
  const id = nanoid();
  const now = new Date().toISOString();
  await db.runAsync(
    "INSERT INTO sticker (id, file_path, label, embedding, imported_at) VALUES (?, ?, ?, ?, ?)",
    [id, params.filePath, params.label || null, params.embedding || null, now],
  );
  return { id, file_path: params.filePath, label: params.label || null, embedding: params.embedding || null, imported_at: now };
}

export async function getAllStickers(): Promise<StickerRow[]> {
  const db = await getDb();
  return db.getAllAsync<StickerRow>("SELECT * FROM sticker ORDER BY imported_at DESC");
}

export async function deleteSticker(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM sticker WHERE id = ?", [id]);
}
