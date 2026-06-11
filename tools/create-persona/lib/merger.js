import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { callLLM } from "./api.js";
import { PROMPTS } from "./prompts.js";

const OUTPUT_DIR = join(import.meta.dirname, "..", "output");

/**
 * 将新聊天记录合并到现有 Persona
 */
export async function mergeNewContent(slug, newContent) {
  const dir = join(OUTPUT_DIR, slug);
  const personaPath = join(dir, "persona.json");
  const memoriesPath = join(dir, "memories.json");

  if (!existsSync(personaPath)) {
    console.log(`\u274C 未找到 ${slug} 的 Persona 文件，请先创建`);
    return null;
  }

  const persona = JSON.parse(readFileSync(personaPath, "utf-8"));
  const memories = existsSync(memoriesPath) ? JSON.parse(readFileSync(memoriesPath, "utf-8")) : {};

  console.log(`\n\u{1F504} 正在合并新内容...`);

  const prompt = PROMPTS.mergeAnalysis(persona, memories, newContent);
  const result = await callLLM([
    { role: "system", content: "你是增量合并处理器，负责将新内容合并到现有 Persona 数据。" },
    { role: "user", content: prompt },
  ]);

  try {
    const cleaned = result.replace(/^\`\`\`(json)?\s*|\`\`\`$/g, "").trim();
    const mergeResult = JSON.parse(cleaned);

    // 应用更新
    if (mergeResult.personaUpdates) {
      for (const [key, val] of Object.entries(mergeResult.personaUpdates)) {
        if (Array.isArray(persona.layers[key])) {
          persona.layers[key] = [...new Set([...persona.layers[key], ...(Array.isArray(val) ? val : [val])])];
        }
      }
      writeFileSync(personaPath, JSON.stringify(persona, null, 2), "utf-8");
    }

    if (mergeResult.memoriesUpdates) {
      for (const [key, val] of Object.entries(mergeResult.memoriesUpdates)) {
        if (Array.isArray(memories[key])) {
          memories[key] = [...new Set([...memories[key], ...(Array.isArray(val) ? val : [val])])];
        }
      }
      writeFileSync(memoriesPath, JSON.stringify(memories, null, 2), "utf-8");
    }

    // 更新版本号
    const metaPath = join(dir, "meta.json");
    if (existsSync(metaPath)) {
      const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
      const verNum = parseInt(meta.version.replace("v", "")) || 1;
      meta.version = `v${verNum + 1}`;
      meta.updatedAt = new Date().toISOString();
      writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");
    }

    return mergeResult;
  } catch {
    console.log("\u26A0\uFE0F 合并处理解析失败");
    return { raw: result };
  }
}
