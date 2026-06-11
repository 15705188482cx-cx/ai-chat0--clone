const MAX_HISTORY_TURNS = 20;
const FEWSHOT_MAX_CHARS = 2000;

export function trimHistory(
  history: Array<{ role: "user" | "persona"; text: string }>,
  maxTurns: number = MAX_HISTORY_TURNS,
): Array<{ role: "user" | "persona"; text: string }> {
  return history.slice(-maxTurns * 2);
}

export function trimFewShotSamples(
  samples: string[],
  maxChars: number = FEWSHOT_MAX_CHARS,
): string {
  let result = "";
  for (const s of samples) {
    if (result.length + s.length > maxChars) break;
    result += s + "\n\n";
  }
  return result.trim();
}

export function estimateTokenCount(text: string): number {
  // 粗略估算：中文约 1.5 字符/token，英文约 4 字符/token
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}
