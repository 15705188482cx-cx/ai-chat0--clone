// =============================================================================
// database 模块统一导出
// =============================================================================

// 存储层核心
export { getStore, setStoreForTest, resetStore } from "./storeProvider";
export { WebStore } from "./WebStore";
export { NativeStore } from "./NativeStore";

// 接口与类型
export type { IDataStore, ChatRecordRow, ConversationRow, MessageRow, StickerRow } from "./IDataStore";
export { StoreNotReadyError, RecordNotFoundError, InvalidArgumentError, StorageQuotaError } from "./IDataStore";

// SQLite 原生导出（仅用于特殊场景）
export { getDatabase, closeDatabase } from "./db";
