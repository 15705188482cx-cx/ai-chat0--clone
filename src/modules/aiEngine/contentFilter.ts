const BLOCKED_PATTERNS: RegExp[] = [
  // 敏感内容关键词列表（项目内部维护）
];

/**
 * 过滤 AI 回复中的敏感内容。
 * 匹配到禁止关键词时返回 "[内容已过滤，请重试]"。
 */
export function filterResponse(text: string): string {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return "[内容已过滤，请重试]";
    }
  }
  return text;
}

export const DISCLAIMER_TEXT =
  "AI 生成内容仅供参考，不代表真实人物观点。请勿用于非法用途。";
