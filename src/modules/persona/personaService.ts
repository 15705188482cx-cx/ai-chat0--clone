import { getDatabase } from "../database/db";
import { isWeb, addPersonaToMemory, getPersonaFromMemory, getAllPersonasFromMemory, deletePersonaFromMemory } from "../database/memoryFallback";
import { getDistinctSenders, getSampleBySender } from "../database/repositories/chatRecordRepo";
import { analyzeStyle, analyzeStyleFull } from "../aiEngine/styleAnalyzer";
import { nanoid } from "nanoid";
import type { Persona, PersonaLayers, PersonaCorrection } from "./types";

export async function getAvailableSenders(): Promise<string[]> {
  if (isWeb()) {
    const { getMemoryDistinctSenders } = await import("../database/memoryFallback");
    return Promise.resolve(getMemoryDistinctSenders());
  }
  return getDistinctSenders();
}

/**
 * 创建分身（新版：支持 5 层分析）
 */
export async function createPersona(params: {
  name: string;
  sourceSender: string;
  sampleCount?: number;
  extraInfo?: string;     // 可选：用户填写的性格描述等额外信息
}): Promise<Persona> {
  const { name, sourceSender, sampleCount = 20, extraInfo = "" } = params;
  const db = await getDatabase();

  // 抽取对话样本
  const samples = await getSampleBySender(sourceSender, sampleCount);
  if (samples.length === 0) {
    throw new Error(`未找到发送者"${sourceSender}"的聊天记录`);
  }

  const sampleTexts = samples.map((s) => s.content);

  // 尝试全量 5 层分析，降级为简易分析
  let styleSummary = "";
  let layersJson = "{}";
  try {
    const full = await analyzeStyleFull(sampleTexts, extraInfo);
    styleSummary = full.styleSummary;
    layersJson = JSON.stringify(full.layers);
  } catch {
    styleSummary = await analyzeStyle(sampleTexts);
  }

  const id = nanoid();
  const sampleIds = samples.map((s) => s.id);

  await db.runAsync(
    `INSERT INTO persona (id, name, source_sender, chat_sample_ids, style_summary, layers_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, sourceSender, JSON.stringify(sampleIds), styleSummary, layersJson],
  );

  const persona = {
    id,
    name,
    sourceSender,
    chatSampleIds: sampleIds,
    styleSummary,
    layers: JSON.parse(layersJson),
    createdAt: new Date().toISOString(),
  };

  if (isWeb()) {
    addPersonaToMemory(persona);
  }

  return persona;
}

export async function getAllPersonas(): Promise<Persona[]> {
  if (isWeb()) {
    return getAllPersonasFromMemory();
  }
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    "SELECT * FROM persona ORDER BY created_at DESC"
  );

  return rows.map(parsePersonaRow);
}

export async function getPersonaById(id: string): Promise<Persona | null> {
  if (isWeb()) {
    return getPersonaFromMemory(id) || null;
  }
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    "SELECT * FROM persona WHERE id = ?", [id]
  );
  return row ? parsePersonaRow(row) : null;
}

export async function deletePersona(id: string): Promise<void> {
  if (isWeb()) {
    deletePersonaFromMemory(id);
    return;
  }
  const db = await getDatabase();
  await db.runAsync("DELETE FROM persona WHERE id = ?", [id]);
}

/**
 * 根据 sourceSender 查找已有分身
 */
export async function findPersonaBySender(senderName: string): Promise<Persona | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    "SELECT * FROM persona WHERE source_sender = ? LIMIT 1", [senderName]
  );
  return row ? parsePersonaRow(row) : null;
}

/**
 * 为已有分身追加新的聊天样本
 */
export async function addSamplesToPersona(personaId: string, count = 20): Promise<Persona> {
  const persona = await getPersonaById(personaId);
  if (!persona) throw new Error("分身不存在");

  const db = await getDatabase();
  const samples = await getSampleBySender(persona.sourceSender, count);
  const newIds = samples.map((s) => s.id);
  const merged = [...new Set([...persona.chatSampleIds, ...newIds])].slice(0, count);

  // 重新分析
  const sampleTexts = samples.map((s) => s.content);
  try {
    const full = await analyzeStyleFull(sampleTexts);
    await db.runAsync(
      "UPDATE persona SET chat_sample_ids = ?, style_summary = ?, layers_json = ? WHERE id = ?",
      [JSON.stringify(merged), full.styleSummary, JSON.stringify(full.layers), personaId],
    );
    return { ...persona, chatSampleIds: merged, styleSummary: full.styleSummary, layers: full.layers };
  } catch {
    const styleSummary = await analyzeStyle(sampleTexts);
    await db.runAsync(
      "UPDATE persona SET chat_sample_ids = ?, style_summary = ? WHERE id = ?",
      [JSON.stringify(merged), styleSummary, personaId],
    );
    return { ...persona, chatSampleIds: merged, styleSummary };
  }
}

// ======= 新增：5 层数据管理 =======

/**
 * 更新分身的 5 层数据
 */
export async function updatePersonaLayers(personaId: string, layers: PersonaLayers): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE persona SET layers_json = ? WHERE id = ?",
    [JSON.stringify(layers), personaId],
  );
}

/**
 * 添加纠正记录
 */
export async function addCorrection(
  personaId: string,
  correction: PersonaCorrection,
): Promise<void> {
  const persona = await getPersonaById(personaId);
  if (!persona) throw new Error("分身不存在");

  const corrections = persona.corrections || [];
  corrections.push(correction);

  const db = await getDatabase();
  await db.runAsync(
    "UPDATE persona SET corrections_json = ? WHERE id = ?",
    [JSON.stringify(corrections), personaId],
  );
}

/**
 * 从 CLI 工具生成的 JSON 文件导入完整 Persona
 */
export async function importPersonaFromCli(cliData: {
  name: string;
  layers: PersonaLayers;
  styleSummary?: string;
  corrections?: PersonaCorrection[];
}): Promise<Persona> {
  const db = await getDatabase();
  const id = nanoid();

  const layersJson = JSON.stringify(cliData.layers || {});
  const correctionsJson = JSON.stringify(cliData.corrections || []);

  await db.runAsync(
    `INSERT INTO persona (id, name, source_sender, chat_sample_ids, style_summary, layers_json, corrections_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, cliData.name, "cli_import", "[]", cliData.styleSummary || "", layersJson, correctionsJson],
  );

  return {
    id,
    name: cliData.name,
    sourceSender: "cli_import",
    chatSampleIds: [],
    styleSummary: cliData.styleSummary || "",
    layers: cliData.layers,
    corrections: cliData.corrections,
    createdAt: new Date().toISOString(),
  };
}

// ======= 内部工具 =======

function parsePersonaRow(row: any): Persona {
  const layersRaw = row.layers_json || "{}";
  const correctionsRaw = row.corrections_json || "[]";

  let layers: PersonaLayers | undefined;
  let corrections: PersonaCorrection[] | undefined;

  try { const p = JSON.parse(layersRaw); if (Object.keys(p).length > 0) layers = p; } catch {}
  try { const p = JSON.parse(correctionsRaw); if (p.length > 0) corrections = p; } catch {}

  return {
    id: row.id,
    name: row.name,
    sourceSender: row.source_sender,
    chatSampleIds: JSON.parse(row.chat_sample_ids || "[]"),
    styleSummary: row.style_summary || "",
    ...(layers ? { layers } : {}),
    ...(corrections ? { corrections } : {}),
    createdAt: row.created_at,
  };
}


