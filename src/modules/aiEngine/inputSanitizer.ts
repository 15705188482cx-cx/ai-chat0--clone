const INJECTION_PATTERNS = [
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /忽略.*指令/i,
  /ignore.*instruction/i,
  /你现在是/i,
  /system:\s*/i,
  /\[system\]/i,
];

const MAX_INPUT_LENGTH = 500;

/**
 * 净化用户输入：移除潜在 Prompt 注入标记，裁剪过长输入。
 */
export function sanitizeUserInput(input: string): string {
  let sanitized = input;

  // 移除 LLM 特殊 token 标记
  sanitized = sanitized.replace(/<\|[\w_]+\|>/g, "");

  // 检查注入特征——仅移除已知危险标记，不改变正常对话内容
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  // 裁剪过长输入
  if (sanitized.length > MAX_INPUT_LENGTH) {
    sanitized = sanitized.slice(0, MAX_INPUT_LENGTH);
  }

  return sanitized.trim();
}
