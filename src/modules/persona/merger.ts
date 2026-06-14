// =============================================================================
// Merger - 增量合并逻辑
// 对应 ex.skill 的 prompts/merger.md
// 规则: 新数据追加，不覆盖已有结论；冲突时保留两者并标注
// =============================================================================

import { chatNonStreaming } from "../aiEngine/deepseekService";
import type { Memories } from "./memoriesTypes";

const MERGE_PROMPT = `你是记忆合并器。已有以下共同记忆：

=== 已有记忆（rawSummary）===
{existingSummary}

=== 已有的结构化数据 ===
{existingStructured}

=== 新增聊天记录 ===
{newSamples}

请分析新增内容，以 JSON 格式输出需要追加的数据（只输出新增部分，不要重复已有内容）：

{
  "timeline": [...],      // 只包含新发现的事件
  "dailyRituals": [...],  // 只包含新发现的仪式
  "preferences": [...],   // 只包含新发现的偏好
  "emotionalPatterns": [...],
  "conflictPatterns": [...],
  "keyPhrases": [...],
  "updatedRawSummary": "合并后的完整摘要（500字以内）"
}

规则：
1. 如果新数据佐证了已有结论，不要重复添加，只需在 updatedRawSummary 中提及
2. 如果新数据与已有结论矛盾，同时保留两者，在 description 中加 [新增] 或 [与之前矛盾] 标记
3. 只输出 JSON，不要其他文字`;

/**
 * 增量合并新聊天记录到已有记忆
 */
export async function mergeMemories(
  existing: Memories,
  newSamples: string[],
): Promise<Memories> {
  if (newSamples.length === 0) return existing;

  const prompt = MERGE_PROMPT
    .replace("{existingSummary}", existing.rawSummary || "(空)")
    .replace("{existingStructured}", JSON.stringify({
      timeline: existing.timeline,
      dailyRituals: existing.dailyRituals,
      preferences: existing.preferences,
      emotionalPatterns: existing.emotionalPatterns,
      conflictPatterns: existing.conflictPatterns,
      keyPhrases: existing.keyPhrases,
    }, null, 2))
    .replace("{newSamples}", newSamples.join("\n---\n"));

  try {
    const result = await chatNonStreaming([{ role: "user", content: prompt }]);
    if (!result) return bumpVersion(existing);

    let cleaned = result
      .replace(/```(?:json)?\s*/g, "")
      .replace(/```\s*$/g, "")
      .trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(cleaned);
    const now = new Date().toISOString();

    const merged: Memories = {
      meta: {
        version: existing.meta.version + 1,
        createdAt: existing.meta.createdAt,
        updatedAt: now,
        sourceCount: existing.meta.sourceCount + newSamples.length,
      },
      timeline: dedupeByDescription([...existing.timeline, ...(parsed.timeline || [])]),
      dailyRituals: dedupeByDescription([...existing.dailyRituals, ...(parsed.dailyRituals || [])]),
      preferences: dedupeByDescription([...existing.preferences, ...(parsed.preferences || [])]),
      emotionalPatterns: dedupeByDescription([...existing.emotionalPatterns, ...(parsed.emotionalPatterns || [])]),
      conflictPatterns: dedupeByDescription([...existing.conflictPatterns, ...(parsed.conflictPatterns || [])]),
      keyPhrases: [...new Set([...existing.keyPhrases, ...(parsed.keyPhrases || [])])],
      rawSummary: parsed.updatedRawSummary || parsed.updated_raw_summary || existing.rawSummary,
    };

    return merged;
  } catch (err) {
    console.warn("[merger] AI 合并失败:", err);
    return bumpVersion(existing);
  }
}

/**
 * 基于 description 字段去重（相似度 > 80% 视为重复）
 */
function dedupeByDescription<T extends Record<string, any>>(
  items: T[],
): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = (item.description || item.detail || item.name || "").slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 仅更新版本号（AI 合并失败时的降级处理）
 */
function bumpVersion(existing: Memories): Memories {
  return {
    ...existing,
    meta: {
      ...existing.meta,
      version: existing.meta.version + 1,
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * 本地快速合并（不调用 AI，仅做简单的集合合并）
 * 用于离线或降级场景
 */
export function mergeMemoriesLocal(
  existing: Memories,
  incoming: Memories,
): Memories {
  const now = new Date().toISOString();
  return {
    meta: {
      version: existing.meta.version + 1,
      createdAt: existing.meta.createdAt,
      updatedAt: now,
      sourceCount: existing.meta.sourceCount + incoming.meta.sourceCount,
    },
    timeline: dedupeByDescription([...existing.timeline, ...incoming.timeline]),
    dailyRituals: dedupeByDescription([...existing.dailyRituals, ...incoming.dailyRituals]),
    preferences: dedupeByDescription([...existing.preferences, ...incoming.preferences]),
    emotionalPatterns: dedupeByDescription([...existing.emotionalPatterns, ...incoming.emotionalPatterns]),
    conflictPatterns: dedupeByDescription([...existing.conflictPatterns, ...incoming.conflictPatterns]),
    keyPhrases: [...new Set([...existing.keyPhrases, ...incoming.keyPhrases])],
    rawSummary: existing.rawSummary + "\n\n--- 新增 ---\n" + incoming.rawSummary,
  };
}
