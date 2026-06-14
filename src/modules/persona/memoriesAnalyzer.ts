// =============================================================================
// Memories Analyzer - AI 驱动的共同记忆提取
// 对应 ex.skill 的 prompts/memories_analyzer.md
// =============================================================================

import { chatNonStreaming } from "../aiEngine/deepseekService";
import type { Memories, TimelineEvent, DailyRitual, Preference, EmotionalPattern, ConflictPattern } from "./memoriesTypes";

/** 默认采样消息数 */
const DEFAULT_SAMPLE_COUNT = 200;

/** 记忆分析 Prompt */
const MEMORIES_ANALYSIS_PROMPT = `你是一个专业的感情分析师。请分析以下聊天记录，提取两个人的共同记忆。

额外信息（用户提供）：{extraInfo}

聊天记录（按时间顺序）：
{chatSamples}

请以 JSON 格式输出分析结果，JSON key 必须使用以下字段名：

{
  "timeline": [
    { "date": "YYYY-MM-DD (如果可推断)", "description": "事件描述", "category": "milestone|daily|conflict|travel|other" }
  ],
  "dailyRituals": [
    { "name": "仪式名称", "description": "具体描述", "frequency": "每天/每周/偶尔" }
  ],
  "preferences": [
    { "category": "食物/娱乐/出行/礼物/其他", "detail": "具体偏好", "confidence": "high|medium|low" }
  ],
  "emotionalPatterns": [
    { "trigger": "触发条件", "herReaction": "她的反应", "yourTypicalResponse": "对方通常的回应", "outcome": "结果" }
  ],
  "conflictPatterns": [
    { "topic": "吵架话题", "howItStarts": "怎么开始的", "howItEscalates": "怎么升级的", "howItResolves": "怎么和好的" }
  ],
  "keyPhrases": ["她常说的关键话语"],
  "rawSummary": "完整的分析摘要（500字以内，包含所有推理依据）"
}

分析要求：
1. 时间线：提取关系中的重要节点（纪念日、旅行、吵架、日常趣事等），最多 15 条
2. 日常仪式：两个人之间的小习惯（谁说晚安、周末做什么、特别称呼等），最多 8 条
3. 偏好：从对话中推断她的喜好（吃什么、玩什么、讨厌什么），最多 10 条
4. 情感模式：她生气/开心/撒娇的规律，最多 5 条
5. 冲突模式：吵架的起因、过程、和解方式，最多 3 条
6. keyPhrases：她标志性的话语或口头禅，最多 10 条
7. rawSummary：必须包含分析推理过程，方便后续增量合并

只输出 JSON，不要其他文字。`;

/**
 * 从聊天记录中提取共同记忆
 */
export async function analyzeMemories(
  samples: string[],
  extraInfo = "",
): Promise<Memories> {
  const sampleTexts = samples.slice(0, DEFAULT_SAMPLE_COUNT);
  if (sampleTexts.length === 0) {
    return createEmptyMemories();
  }

  const prompt = MEMORIES_ANALYSIS_PROMPT
    .replace("{extraInfo}", extraInfo || "无")
    .replace("{chatSamples}", sampleTexts.join("\n---\n"));

  try {
    const result = await chatNonStreaming([{ role: "user", content: prompt }]);
    if (!result) return createEmptyMemories();

    // Robust JSON extraction
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

    return {
      meta: {
        version: 1,
        createdAt: now,
        updatedAt: now,
        sourceCount: sampleTexts.length,
      },
      timeline: (parsed.timeline || []).slice(0, 15),
      dailyRituals: (parsed.dailyRituals || parsed.daily_rituals || []).slice(0, 8),
      preferences: (parsed.preferences || []).slice(0, 10),
      emotionalPatterns: (parsed.emotionalPatterns || parsed.emotional_patterns || []).slice(0, 5),
      conflictPatterns: (parsed.conflictPatterns || parsed.conflict_patterns || []).slice(0, 3),
      keyPhrases: (parsed.keyPhrases || parsed.key_phrases || []).slice(0, 10),
      rawSummary: parsed.rawSummary || parsed.raw_summary || "",
    };
  } catch (err) {
    console.warn("[memoriesAnalyzer] AI 分析失败:", err);
    return createEmptyMemories();
  }
}

/** 创建空记忆结构 */
export function createEmptyMemories(): Memories {
  const now = new Date().toISOString();
  return {
    meta: {
      version: 1,
      createdAt: now,
      updatedAt: now,
      sourceCount: 0,
    },
    timeline: [],
    dailyRituals: [],
    preferences: [],
    emotionalPatterns: [],
    conflictPatterns: [],
    keyPhrases: [],
    rawSummary: "",
  };
}
