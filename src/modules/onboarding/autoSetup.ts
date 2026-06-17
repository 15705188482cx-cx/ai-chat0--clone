// =============================================================================
// autoSetup - 首启动零摩擦 onboarding
// 规则 6(最小实现): 失败不抛,所有错误 console.warn,不阻塞启动
// 规则 5(可测试性): 纯函数 + IDataStore 注入,可在测试中 mock
// 流程: 检测空状态 → 内嵌测试数据 → 创建 fallback 分身 → 创建会话 → 返回跳转 ID
// =============================================================================

import { nanoid } from "nanoid";
import { getStore } from "../database/storeProvider";
import { BUNDLED_CHAT_DATA } from "../testData/bundledTestData";
import { hasApiKeySync } from "../config/apiKeyManager";
import type { Persona } from "../persona/types";

/** 单条聊天记录(与 IDataStore.ChatRecordRow 对齐,id 由存储层生成) */
interface RawRecordInsert {
  batch_id: string;
  sender_name: string;
  content: string;
  timestamp: string;
  session_id: string | null;
  type: string;
}

export interface AutoSetupResult {
  personaId: string;
  conversationId: string;
  senderName: string;
  /** true = 创建了 fallback persona(无 Key 或 LLM 失败);false = 调了 LLM 生成完整人格 */
  fallback: boolean;
  /** 内嵌数据是否真的被写入(已有数据时为 false) */
  seededData: boolean;
}

/**
 * 首启动自动装配主流程。
 * 安全可重入:已有数据/分身/会话时会跳过对应步骤。
 * 返回 null 表示没有可装配的发送者(测试数据为空等异常)。
 */
export async function autoSetup(): Promise<AutoSetupResult | null> {
  let store;
  try {
    store = await getStore();
  } catch (err) {
    console.warn("[autoSetup] 获取存储层失败:", err);
    return null;
  }

  // 1) 写入测试数据(已有则跳过)
  let seededData = false;
  try {
    const existing = await store.getChatRecordCount();
    if (existing === 0) {
      const batchId = nanoid();
      const records: RawRecordInsert[] = BUNDLED_CHAT_DATA
        .filter((r) => r.type === "text" && r.content.trim().length > 0)
        .map((r) => ({
          batch_id: batchId,
          sender_name: r.sender_name,
          content: r.content,
          timestamp: new Date(
            r.time.replace(" ", "T") + "+08:00",
          ).toISOString(),
          session_id: null,
          type: r.type,
        }));
      if (records.length > 0) {
        await store.bulkInsertChatRecords(records);
        seededData = true;
        console.log("[autoSetup] 已写入", records.length, "条测试数据");
      }
    }
  } catch (err) {
    console.warn("[autoSetup] 写入测试数据失败:", err);
  }

  // 2) 找发送者(过滤掉"我")
  let senders: string[] = [];
  try {
    senders = await store.getDistinctSenders();
  } catch (err) {
    console.warn("[autoSetup] 获取发送者失败:", err);
    return null;
  }
  const targetSender = senders.find((s) => s !== "我");
  if (!targetSender) {
    console.warn("[autoSetup] 没有可用的发送者");
    return null;
  }

  // 3) 检查/创建分身(已有则复用)
  let persona: Persona | null = null;
  try {
    const all = await store.getAllPersonas();
    persona = all.find((p) => p.sourceSender === targetSender) ?? null;
  } catch (err) {
    console.warn("[autoSetup] 查询分身失败:", err);
  }

  if (!persona) {
    const fallback = !hasApiKeySync();
    persona = {
      id: nanoid(),
      name: targetSender,
      sourceSender: targetSender,
      chatSampleIds: [],
      styleSummary: fallback
        ? "默认风格(请在设置中配置 API Key 后重新生成风格摘要)"
        : "",
      createdAt: new Date().toISOString(),
    };
    try {
      await store.savePersona(persona);
      console.log("[autoSetup] 已创建", fallback ? "fallback " : "", "分身:", persona.id);
    } catch (err) {
      console.warn("[autoSetup] 保存分身失败:", err);
      return null;
    }
    return {
      personaId: persona.id,
      conversationId: "",
      senderName: targetSender,
      fallback,
      seededData,
    };
  }

  return {
    personaId: persona.id,
    conversationId: "",
    senderName: persona.sourceSender,
    fallback: !persona.layers,
    seededData,
  };
}

/**
 * 创建首条会话(后续在 index.tsx 里调,也可单独用)。
 */
export async function createOnboardingConversation(
  personaId: string,
): Promise<string | null> {
  try {
    const store = await getStore();
    const conv = await store.createConversation(
      personaId,
      "与 她 的对话",
    );
    return conv.id;
  } catch (err) {
    console.warn("[autoSetup] 创建会话失败:", err);
    return null;
  }
}
