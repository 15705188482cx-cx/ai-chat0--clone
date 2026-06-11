const PII_PATTERNS: Array<[RegExp, string]> = [
  [/\b1[3-9]\d{9}\b/g, "1**********"],
  [/\b\d{17}[\dXx]\b/g, "******************"],
  [/\b[\w.-]+@[\w.-]+\.\w+\b/g, "***@***.***"],
];

/**
 * 脱敏处理：手机号、身份证、邮箱替换为占位符。
 * 在发送聊天样本给 LLM 前调用。
 */
export function maskPII(text: string): string {
  let result = text;
  for (const [pattern, replacement] of PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
