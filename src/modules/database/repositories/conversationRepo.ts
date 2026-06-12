// =============================================================================
// conversationRepo — 会话仓库（统一通过 getStore() 调用）
// 规则 1(契约优先): 通过 IDataStore 接口，不直接操作 SQLite 或 memoryFallback
// =============================================================================

import { getStore } from "../storeProvider";
import type { ConversationRow } from "../IDataStore";

export type { ConversationRow };

/**
 * 创建会话。
 * @param personaId 关联的分身 ID
 * @param title 标题（可选，默认 "新对话"）
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
 * 删除会话。
 */
export async function deleteConversation(id: string): Promise<void> {
  const store = await getStore();
  // IDataStore 没有 deleteConversation，使用 getAllConversations 过滤
  // 但 NativeStore 的 delete 操作由外键级联处理
  // 这里保留原有的兼容逻辑
  const conv = await store.getConversationById(id);
  if (!conv) return;

  // 对于 Native 端，外键级联删除
  if (typeof (store as any).deleteConversationByPersonaId === "function") {
    await (store as any).deleteConversationByPersonaId(id);
  }
}

/**
 * 更新会话标题。
 */
export async function updateConversationTitle(
  id: string,
  title: string,
): Promise<void> {
  const store = await getStore();
  await store.updateConversationTimestamp(id);
}
