// =============================================================================
// personaService — 分身业务逻辑层
// 规则 1(契约优先): 通过 getStore() 使用存储层，不直接操作 SQLite 或 localStorage
// 规则 4(显式错误): 不允许空 catch，所有异常传递到调用方
// 规则 5(可测试性): 存储层通过 getStore() 注入
// =============================================================================

import type { IDataStore } from "../database/IDataStore";
import { getStore } from "../database/storeProvider";
import { getDistinctSenders, getSampleBySender } from "../database/repositories/chatRecordRepo";
import { analyzeStyleFull, analyzeStyle } from "../aiEngine/styleAnalyzer";
import { nanoid } from "nanoid";
import type { Persona, PersonaLayers, PersonaCorrection } from "./types";
import type { Memories } from "./memoriesTypes";
import { createEmptyMemories } from "./memoriesAnalyzer";
import type { VersionSnapshot } from "./versionManager";
import { createSnapshot, getVersionHistory, rollbackToVersion, getLatestVersion } from "./versionManager";

// ========== 常量（规则 3）==========
/** 默认采样条数 */
const DEFAULT_SAMPLE_COUNT = 20;

// ========== 公开方法 ==========

/**
 * 获取可用的发送者列表。
 */
export async function getAvailableSenders(): Promise<string[]> {
  return getDistinctSenders();
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
  const samples = await getSampleBySender(sourceSender, sampleCount);

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
  const store = await getStore();
  return store.getAllPersonas();
}

/**
 * 根据 ID 获取分身。
 */
export async function getPersonaById(id: string): Promise<Persona | null> {
  if (!id) return null;
  const store = await getStore();
  return store.getPersonaById(id);
}

/**
 * 删除分身。
 */
export async function deletePersona(id: string): Promise<void> {
  const store = await getStore();
  await store.deletePersona(id);
}

/**
 * 根据源发送者查找分身。
 */
export async function findPersonaBySender(senderName: string): Promise<Persona | null> {
  const store = await getStore();
  const personas = await store.getAllPersonas();
  return personas.find((p) => p.sourceSender === senderName) || null;
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

  const store = await getStore();
  await store.savePersona(updatedPersona);

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
  const store = await getStore();
  await store.savePersona(updated);
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

  const store = await getStore();
  await store.savePersona(updated);
}

/**
 * 从 CLI 生成的 JSON 文件导入 Persona。
 */
/**
 * 通过纯文本描述创建分身（无需聊天记录）。
 * @param params.name 分身名称
 * @param params.description 文字描述（性格、风格、基本信息等）
 * @param params.extraInfo 额外信息（可选）
 */
export async function createPersonaFromText(params: {
  name: string;
  description: string;
  extraInfo?: string;
}): Promise<Persona> {
  const { name, description, extraInfo = "" } = params;

  // 通过 AI 分析描述文本，生成风格摘要
  let styleSummary = "";
  let layers: PersonaLayers = {};
  try {
    const full = await analyzeStyleFull([description], extraInfo);
    styleSummary = full.styleSummary;
    layers = full.layers || {};
  } catch (err) {
    console.warn("[personaService] createPersonaFromText analyzeStyleFull failed:", err);
    try {
      styleSummary = await analyzeStyle([description]);
    } catch (err2) {
      console.error("[personaService] createPersonaFromText analyzeStyle also failed:", err2);
      styleSummary = "（基于文字描述生成，无聊天记录分析）";
    }
  }

  const id = nanoid();
  const persona: Persona = {
    id,
    name,
    sourceSender: "manual_input",
    chatSampleIds: [],
    styleSummary,
    layers,
    createdAt: new Date().toISOString(),
  };

  try {
    const store = await getStore();
    await store.savePersona(persona);
  } catch (err) {
    console.error("[personaService] createPersonaFromText savePersona failed:", err);
    throw new Error("分身保存失败: " + (err instanceof Error ? err.message : "未知错误"));
  }

  return persona;
}

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

  const store = await getStore();
  await store.savePersona(persona);

  return persona;
}


// ======== 记忆管理（通过 IDataStore）========

/**
 * 获取 Persona 关联的记忆。
 * @param personaId 分身 ID
 * @returns Memories 对象，不存在时返回空 Memories
 */
export async function getMemories(personaId: string): Promise<Memories> {
  const store = await getStore();
  return store.getMemories(personaId);
}

/**
 * 保存 Persona 关联的记忆。
 * @param personaId 分身 ID
 * @param memories 记忆对象
 */
export async function saveMemories(personaId: string, memories: Memories): Promise<void> {
  const store = await getStore();
  await store.saveMemories(personaId, memories);
}

// ======== 版本管理 ========

/**
 * 为 Persona 创建快照（包含当前 persona 数据和记忆数据）。
 * @param personaId 分身 ID
 * @param changeDescription 变更说明（可选）
 * @returns 创建的 VersionSnapshot
 */
export async function snapshotPersona(personaId: string, changeDescription?: string): Promise<VersionSnapshot> {
  const store = await getStore();
  const persona = await store.getPersonaById(personaId);
  if (!persona) throw new Error("分身 " + personaId + " 不存在，无法创建快照");

  const memories = await store.getMemories(personaId);
  return createSnapshot(persona, memories, changeDescription || "手动快照 " + new Date().toISOString());
}

/**
 * 获取 Persona 的版本历史。
 * @param personaId 分身 ID
 * @returns VersionSnapshot 数组
 */
export async function getPersonaVersionHistory(personaId: string): Promise<VersionSnapshot[]> {
  return getVersionHistory(personaId);
}

/**
 * 回滚 Persona 到指定版本。
 * @param personaId 分身 ID
 * @param version 目标版本号
 * @returns 回滚后的 Persona
 */
export async function rollbackPersona(personaId: string, version: number): Promise<Persona> {
  const store = await getStore();
  const result = rollbackToVersion(personaId, version);
  if (!result) throw new Error("版本 " + version + " 不存在");

  // 回滚 persona 数据
  await store.savePersona(result.persona);
  // 回滚记忆数据
  await store.saveMemories(personaId, result.memories);

  return result.persona;
}