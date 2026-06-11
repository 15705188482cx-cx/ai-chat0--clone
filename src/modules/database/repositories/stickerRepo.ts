import { getDatabase } from "../db";
import { nanoid } from "nanoid";

export interface StickerRow {
  id: string;
  file_path: string;
  label: string;
  embedding: string | null;
  imported_at: string;
}

export async function insertSticker(params: {
  filePath: string;
  label?: string;
  embedding?: number[];
}): Promise<StickerRow> {
  const db = await getDatabase();
  const id = nanoid();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO sticker (id, file_path, label, embedding, imported_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      id,
      params.filePath,
      params.label ?? "",
      params.embedding ? JSON.stringify(Array.from(params.embedding)) : null,
      now,
    ],
  );

  return {
    id,
    file_path: params.filePath,
    label: params.label ?? "",
    embedding: params.embedding ? JSON.stringify(Array.from(params.embedding)) : null,
    imported_at: now,
  };
}

export async function getAllStickers(): Promise<StickerRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<StickerRow>(
    "SELECT * FROM sticker ORDER BY imported_at DESC",
  );
}

export async function deleteSticker(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM sticker WHERE id = ?", [id]);
}

export async function getStickerCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM sticker",
  );
  return row?.cnt ?? 0;
}
