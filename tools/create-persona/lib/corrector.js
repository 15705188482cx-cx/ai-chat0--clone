import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { callLLM } from "./api.js";
import { PROMPTS } from "./prompts.js";

const OUTPUT_DIR = join(import.meta.dirname, "..", "output");

/**
 * 处理用户纠正
 */
export async function handleCorrection(slug, userCorrection) {
  const dir = join(OUTPUT_DIR, slug);
  const personaPath = join(dir, "persona.json");
  const memoriesPath = join(dir, "memories.json");

  if (!existsSync(personaPath)) {
    console.log(`\u274C 未找到 ${slug} 的 Persona 文件`);
    return null;
  }

  const persona = JSON.parse(readFileSync(personaPath, "utf-8"));
  const memories = existsSync(memoriesPath) ? JSON.parse(readFileSync(memoriesPath, "utf-8")) : {};

  console.log(`\n\u{1F504} 正在处理纠正...`);

  const prompt = PROMPTS.correctionAnalysis(persona, memories, userCorrection);
  const result = await callLLM([
    { role: "system", content: "你是 Persona 纠正处理器，负责识别和记录用户对 AI 分身的纠正。" },
    { role: "user", content: prompt },
  ]);

  try {
    const cleaned = result.replace(/^\`\`\`(json)?\s*|\`\`\`$/g, "").trim();
    const correction = JSON.parse(cleaned);

    // 追加 correction 记录
    if (correction.belongsTo === "persona") {
      if (!persona.corrections) persona.corrections = [];
      persona.corrections.push({
        scene: correction.scene,
        wrongBehavior: correction.wrongBehavior,
        correctBehavior: correction.correctBehavior,
        timestamp: new Date().toISOString(),
      });
      writeFileSync(personaPath, JSON.stringify(persona, null, 2), "utf-8");
    }

    // 更新 meta.json 版本
    const metaPath = join(dir, "meta.json");
    if (existsSync(metaPath)) {
      const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
      const verNum = parseInt(meta.version.replace("v", "")) || 1;
      meta.version = `v${verNum + 1}`;
      meta.updatedAt = new Date().toISOString();
      meta.correctionsCount = (meta.correctionsCount || 0) + 1;
      writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");
    }

    return correction;
  } catch {
    console.log("\u26A0\uFE0F 纠正处理解析失败");
    return { raw: result };
  }
}
