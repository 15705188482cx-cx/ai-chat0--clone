import { callLLM } from "../aiEngine/api";

/**
 * 处理用户的自然语言纠正：分析用户说的话，提取纠正内容
 */
export async function parseCorrection(
  personaName: string,
  userCorrection: string,
): Promise<{
  scene: string;
  wrongBehavior: string;
  correctBehavior: string;
  correctionRecord: string;
}> {
  const prompt = `你是 Persona 纠正处理器。

用户正在纠正 AI 分身 "${personaName}" 的行为。

用户说：${userCorrection}

请分析这段话，输出 JSON 格式：
{
  "scene": "在什么情况下（如：撒娇时、吵架时、说晚安时）",
  "wrongBehavior": "AI 做错了什么（如：直接说想你了）",
  "correctBehavior": "她实际会怎么做（如：发个表情包等着对方来找她）",
  "correctionRecord": "[场景：场景描述] 不应该 wrongBehavior，应该 correctBehavior"
}`;

  const result = await callLLM([
    { role: "user", content: prompt },
  ]);

  const cleaned = result.replace(/^\`\`\`(json)?\s*|\`\`\`$/g, "").trim();
  return JSON.parse(cleaned);
}
