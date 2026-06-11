import type { StickerRecord, StickerSearchResult } from "./types";

/**
 * MVP 降级方案：基于标签关键词匹配
 */
export function keywordMatch(
  query: string,
  stickers: StickerRecord[],
  topK: number = 1,
): StickerSearchResult[] {
  const tokens = query.toLowerCase().split(/[\s,，、]+/).filter(Boolean);

  return stickers
    .map((s) => {
      const label = s.label.toLowerCase();
      const matchCount = tokens.filter((t) => label.includes(t)).length;
      return {
        id: s.id,
        filePath: s.filePath,
        label: s.label,
        score: tokens.length > 0 ? matchCount / tokens.length : 0,
      };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
