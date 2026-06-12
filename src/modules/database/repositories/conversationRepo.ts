// =============================================================================
// conversationRepo — 会话仓库（统一通过 getStore() 调用）
// 规则 1(契约优先): 通过 IDataStore 接口，不直接操作任何存储后端
// =============================================================================

import { getStore } from "../storeProvider";
import type { ConversationRow } from "../IDataStore";

export type { ConversationRow };

/**
 * 创建会话。
 */
export async function createConversation(
  personaId: string,
  title?: string,
): Promise<ConversationRow> {
  const store = await getStore();
  return store.createConversation(personaId, title);
}

/**
 * 获取所有会话（按 updated_at 倒序）。
 */
export async function getAllConversations(): Promise<ConversationRow[]> {
  const store = await getStore();
  return store.getAllConversations();
}

/**
 * 根据 ID 获取会话。
 */
export async function getConversationById(
  id: string,
): Promise<ConversationRow | null> {
  const store = await getStore();
  return store.getConversationById(id);
}

/**
 * 删除会话及其关联消息。
 */
export async function deleteConversation(id: string): Promise<void> {
  const store = await getStore();
  await store.deleteConversation(id);
}

/**
 * 更新会话标题。
 */
export async function updateConversationTitle(
  id: string,
  title: string,
): Promise<void> {
  const store = await getStore();
  await store.updateConversationTitle(id, title);
}
