/**
 * 移除 UTF-8 BOM（文件开头的 \uFEFF 字符）
 */
export function stripBOM(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}

/**
 * 启发式检测 GBK 编码乱码。
 * 采样前 1000 字符，如果 Unicode 替换字符 (U+FFFD) 比例 > 10%，判定为乱码。
 */
export function isLikelyGBK(content: string): boolean {
  const sample = content.slice(0, 1000);
  const replacementCharCount = (sample.match(/\uFFFD/g) || []).length;
  return replacementCharCount > sample.length * 0.1;
}
