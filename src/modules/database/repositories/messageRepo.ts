// =============================================================================
// messageRepo — 消息仓库（统一通过 getStore() 调用）
// 规则 1(契约优先): 通过 IDataStore 接口
// =============================================================================

import { getStore } from "../storeProvider";
import type { MessageRow } from "../IDataStore";

export type { MessageRow };

/**
 * 插入消息。
 */
export async function insertMessage(params: {
  conversationId: string;
  role: "user" | "persona";
  textContent: string;
  stickerId?: string | null;
}): Promise<void> {
  const store = await getStore();
  await store.insertMessage(
    params.conversationId,
    params.role,
    params.textContent,
    params.stickerId ?? undefined,
  );
}

/**
 * 获取指定会话的最新消息。
 */
export async function getLatestMessages(
  conversationId: string,
  limit = 50,
): Promise<MessageRow[]> {
  const store = await getStore();
  return store.getLatestMessages(conversationId, limit);
}
