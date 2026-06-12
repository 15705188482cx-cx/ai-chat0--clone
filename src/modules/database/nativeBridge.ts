// =============================================================================
// nativeBridge.ts — 原生端专用桥梁（Web 端永不加载）
// 封装需要 expo-sqlite 的操作，仅在原生平台被动态加载
// =============================================================================

/** 创建导入批次记录（仅原生端需要，Web 端由 WebStore（IDataStore）处理） */
export async function createImportBatchWeb(batch: {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  total_messages: number;
  ignored_count: number;
  participant_count: number;
  time_span_start: string | null;
  time_span_end: string | null;
}): Promise<void> {
  const { getDatabase } = await import("./db");
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO import_batch (id, file_name, file_type, file_size, total_messages, ignored_count, 
     participant_count, time_span_start, time_span_end)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      batch.id,
      batch.file_name,
      batch.file_type,
      batch.file_size,
      batch.total_messages,
      batch.ignored_count,
      batch.participant_count || 0,
      batch.time_span_start,
      batch.time_span_end,
    ],
  );
}

