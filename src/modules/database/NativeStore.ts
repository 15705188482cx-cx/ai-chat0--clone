// =============================================================================
// NativeStore — Web 端占位（原生端使用 NativeStore.native.ts）
// 此文件仅在 Web 端被 Metro 解析，提供类型兼容的空实现
// 规则 7(失败快速): 调用任何方法都抛异常，提醒不应在 Web 端使用
// =============================================================================

import type { IDataStore } from "./IDataStore";

export class NativeStore implements IDataStore {
  async init(): Promise<void> {
    throw new Error("[NativeStore] 不应在 Web 端初始化 NativeStore");
  }
  async getChatRecordCount(): Promise<number> { throw new Error("Not on Web"); }
  async getDistinctSenders(): Promise<string[]> { throw new Error("Not on Web"); }
  async getSamplesBySender(): Promise<any> { throw new Error("Not on Web"); }
  async bulkInsertChatRecords(): Promise<number> { throw new Error("Not on Web"); }
  async savePersona(): Promise<void> { throw new Error("Not on Web"); }
  async getAllPersonas(): Promise<any[]> { throw new Error("Not on Web"); }
  async getPersonaById(): Promise<any> { throw new Error("Not on Web"); }
  async deletePersona(): Promise<void> { throw new Error("Not on Web"); }
  async createConversation(): Promise<any> { throw new Error("Not on Web"); }
  async getConversationById(): Promise<any> { throw new Error("Not on Web"); }
  async getAllConversations(): Promise<any[]> { throw new Error("Not on Web"); }
  async updateConversationTimestamp(): Promise<void> { throw new Error("Not on Web"); }
  async insertMessage(): Promise<void> { throw new Error("Not on Web"); }
  async getLatestMessages(): Promise<any[]> { throw new Error("Not on Web"); }
}
