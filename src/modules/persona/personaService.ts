// =============================================================================
// personaService — 分身业务逻辑层
// 规则 1(契约优先): 通过 getStore() 使用存储层，不直接操作 SQLite 或 localStorage
// 规则 4(显式错误): 不允许空 catch，所有异常传递到调用方
// 规则 5(可测试性): 存储层通过 getStore() 注入
// =============================================================================

import type { IDataStore } from "../database/IDataStore";
import { getStore } from "../database/storeProvider";
import { getDistinctSenders, getSampleBySender } from "../database/repositories/chatRecordRepo";
import { getMemoryDistinctSenders, getMemorySamplesBySender, isWeb } from "../database/memoryFallback";
import { analyzeStyleFull, analyzeStyle } from "../aiEngine/styleAnalyzer";
import { nanoid } from "nanoid";
import type { Persona, PersonaLayers, PersonaCorrection } from "./types";

// ========== 常量（规则 3）==========
/** 默认采样条数 */
const DEFAULT_SAMPLE_COUNT = 20;

// ========== 公开方法 ==========

/**
 * 获取可用的发送者列表。
 * 先在 SQLite 査，失败后降级到内存存储。
 */
export async function getAvailableSenders(): Promise<string[]> {
  try {
    const store = await getStore();
    return await store.getDistinctSenders();
  } catch (err) {
    console.warn("[personaService] getStore().getDistinctSenders 失败，降级到 memoryFallback:", err);
    return getMemoryDistinctSenders();
  }
}

/**
 * 创建分身。
 * @param params.name 分身名称
 * @param params.sourceSender 源发送者
 * @param params.sampleCount 采样条数（默认 20）
 * @param params.extraInfo 额外信息（可选）
 * @throws 如果找不到源发送者的聊天记录
 */
export async function createPersona(params: {
  name: string;
  sourceSender: string;
  sampleCount?: number;
  extraInfo?: string;
}): Promise<Persona> {
  const { name, sourceSender, sampleCount = DEFAULT_SAMPLE_COUNT, extraInfo = "" } = params;

  // 获取样本
  let samples = await getSampleBySender(sourceSender, sampleCount);
  if (samples.length === 0 && isWeb()) {
    const texts = getMemorySamplesBySender(sourceSender, sampleCount);
    if (texts.length > 0) {
      samples = texts.map((t, i) => ({
        id: "mem-" + i,
        batch_id: "mem",
        sender_name: sourceSender,
        content: t,
        timestamp: new Date().toISOString(),
        session_id: null,
        type: "text",
      }));
    }
  }

  if (samples.length === 0) {
    throw new Error("未找到联系人\"" + sourceSender + "\"的聊天记录");
  }

  // 分析风格（规则 4：捕获异常后显式降级）
  let styleSummary = "";
  let layers: PersonaLayers = {};
  try {
    const full = await analyzeStyleFull(
      samples.map((s) => s.content),
      extraInfo,
    );
    styleSummary = full.styleSummary;
    layers = full.layers || {};
  } catch (err) {
    console.warn("[personaService] analyzeStyleFull 失败，降级到 analyzeStyle:", err);
    try {
      styleSummary = await analyzeStyle(samples.map((s) => s.content));
    } catch (err2) {
      console.error("[personaService] analyzeStyle 也失败:", err2);
      styleSummary = "（风格分析失败，使用默认风格）";
    }
  }

  // 创建分身对象
  const id = nanoid();
  const sampleIds = samples.map((s) => s.id);
  const persona: Persona = {
    id,
    name,
    sourceSender,
    chatSampleIds: sampleIds,
    styleSummary,
    layers,
    createdAt: new Date().toISOString(),
  };

  // 保存到存储层
  try {
    const store = await getStore();
    await store.savePersona(persona);
  } catch (err) {
    console.error("[personaService] savePersona 失败:", err);
    throw new Error("分身保存失败: " + (err instanceof Error ? err.message : "未知错误"));
  }

  return persona;
}

/**
 * 获取所有分身。
 */
export async function getAllPersonas(): Promise<Persona[]> {
  try {
    const store = await getStore();
    return await store.getAllPersonas();
  } catch (err) {
    console.error("[personaService] getAllPersonas 失败:", err);
    return [];
  }
}

/**
 * 根据 ID 获取分身。
 */
export async function getPersonaById(id: string): Promise<Persona | null> {
  try {
    const store = await getStore();
    return await store.getPersonaById(id);
  } catch (err) {
    console.error("[personaService] getPersonaById 失败:", err);
    return null;
  }
}

/**
 * 删除分身。
 */
export async function deletePersona(id: string): Promise<void> {
  try {
    const store = await getStore();
    await store.deletePersona(id);
  } catch (err) {
    console.error("[personaService] deletePersona 失败:", err);
    throw err;
  }
}

/**
 * 根据源发送者查找分身。
 */
export async function findPersonaBySender(senderName: string): Promise<Persona | null> {
  try {
    const store = await getStore();
    const personas = await store.getAllPersonas();
    return personas.find((p) => p.sourceSender === senderName) || null;
  } catch (err) {
    console.error("[personaService] findPersonaBySender 失败:", err);
    return null;
  }
}

/**
 * 为分身追加更多样本。
 */
export async function addSamplesToPersona(personaId: string, count = DEFAULT_SAMPLE_COUNT): Promise<Persona> {
  const persona = await getPersonaById(personaId);
  if (!persona) throw new Error("分身不存在");

  const samples = await getSampleBySender(persona.sourceSender, count);
  const newIds = samples.map((s) => s.id);
  const merged = [...new Set([...persona.chatSampleIds, ...newIds])].slice(0, count);

  // 重新分析
  const sampleTexts = samples.map((s) => s.content);
  let styleSummary = persona.styleSummary;
  let layers = persona.layers || {};
  try {
    const full = await analyzeStyleFull(sampleTexts);
    styleSummary = full.styleSummary;
    layers = full.layers || {};
  } catch (err) {
    console.warn("[personaService] addSamplesToPersona reanalyze 失败:", err);
  }

  const updatedPersona: Persona = {
    ...persona,
    chatSampleIds: merged,
    styleSummary,
    layers,
  };

  // 保存
  try {
    const store = await getStore();
    await store.savePersona(updatedPersona);
  } catch (err) {
    console.error("[personaService] addSamplesToPersona 保存失败:", err);
    throw err;
  }

  return updatedPersona;
}

// ======= 5 层数据管理 =======

/**
 * 更新分身的多层分析数据。
 */
export async function updatePersonaLayers(personaId: string, layers: PersonaLayers): Promise<void> {
  const persona = await getPersonaById(personaId);
  if (!persona) throw new Error("分身不存在");

  const updated = { ...persona, layers };
  try {
    const store = await getStore();
    await store.savePersona(updated);
  } catch (err) {
    console.error("[personaService] updatePersonaLayers 失败:", err);
    throw err;
  }
}

/**
 * 添加纠正记录。
 */
export async function addCorrection(
  personaId: string,
  correction: PersonaCorrection,
): Promise<void> {
  const persona = await getPersonaById(personaId);
  if (!persona) throw new Error("分身不存在");

  const corrections = [...(persona.corrections || []), correction];
  const updated = { ...persona, corrections };

  try {
    const store = await getStore();
    await store.savePersona(updated);
  } catch (err) {
    console.error("[personaService] addCorrection 失败:", err);
    throw err;
  }
}

/**
 * 从 CLI 生成的 JSON 文件导入 Persona。
 */
export async function importPersonaFromCli(cliData: {
  name: string;
  layers: PersonaLayers;
  styleSummary?: string;
  corrections?: PersonaCorrection[];
}): Promise<Persona> {
  const id = nanoid();
  const persona: Persona = {
    id,
    name: cliData.name,
    sourceSender: "cli_import",
    chatSampleIds: [],
    styleSummary: cliData.styleSummary || "",
    layers: cliData.layers,
    corrections: cliData.corrections,
    createdAt: new Date().toISOString(),
  };

  try {
    const store = await getStore();
    await store.savePersona(persona);
  } catch (err) {
    console.error("[personaService] importPersonaFromCli 失败:", err);
    throw err;
  }

  return persona;
}
