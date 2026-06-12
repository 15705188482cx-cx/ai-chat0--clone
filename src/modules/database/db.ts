// =============================================================================
// db.ts — Web 端 SQLite 占位（原生端使用 db.native.ts）
// Web 端通过 WebStore 使用 localStorage，不需要 SQLite
// 规则 7(失败快速): 调用 getDatabase 会抛出清晰异常
// =============================================================================

/**
 * Web 端占位函数。
 * Web 端不应该调用原生 SQLite，所有数据通过 getStore() → WebStore 访问。
 * @throws Error 始终抛异常，提示开发者不应在 Web 端使用原生 SQLite
 */
export async function getDatabase(): Promise<any> {
  throw new Error(
    "[db.ts] Web 端不应直接调用 SQLite。请使用 getStore()（src/modules/database/storeProvider）",
  );
}

export async function closeDatabase(): Promise<void> {
  // Web 端无操作
}
