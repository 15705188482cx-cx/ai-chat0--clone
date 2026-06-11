import { callLLM } from "./api.js";
import { PROMPTS } from "./prompts.js";

/**
 * 分析聊天记录，生成 5 层 Persona
 */
export async function analyzePersona(samples, name, extraInfo = "") {
  console.log(`\n\u{1F9D0} 正在分析 ${name} 的性格特征...`);

  const prompt = PROMPTS.personaAnalysis(samples, name, extraInfo);
  const result = await callLLM([
    { role: "system", content: "你是一个专业的性格分析专家。请严格按照要求输出 JSON 格式。" },
    { role: "user", content: prompt },
  ]);

  // 尝试解析 JSON
  try {
    // 去除 markdown 代码块标记
    const cleaned = result.replace(/^\`\`\`(json)?\s*|\`\`\`$/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    // 如果解析失败，返回原始文本
    console.log("\u26A0\uFE0F JSON 解析失败，返回原始分析结果");
    return { raw: result };
  }
}

/**
 * 分析聊天记录，提取共同记忆
 */
export async function analyzeMemories(samples, name) {
  console.log(`\n\u{1F4AC} 正在提取与 ${name} 的共同记忆...`);

  const prompt = PROMPTS.memoriesAnalysis(samples, name);
  const result = await callLLM([
    { role: "system", content: "你是一个情感记忆分析师。请严格按照要求输出 JSON 格式。" },
    { role: "user", content: prompt },
  ]);

  try {
    const cleaned = result.replace(/^\`\`\`(json)?\s*|\`\`\`$/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { raw: result };
  }
}

/**
 * 简化版风格分析（兼容现有 app 使用）
 */
export async function analyzeStyle(samples, name) {
  console.log(`\n\u{1F3AD} 正在分析 ${name} 的聊天风格...`);

  const prompt = PROMPTS.styleAnalysis(samples, name);
  const result = await callLLM([
    { role: "system", content: "你是一个语言风格分析专家。" },
    { role: "user", content: prompt },
  ]);

  return result;
}
