// =============================================================================
// Memories Builder - 将结构化记忆格式化为可读文本
// 对应 ex.skill 的 prompts/memories_builder.md
// =============================================================================

import type { Memories, TimelineEvent, DailyRitual, Preference, EmotionalPattern, ConflictPattern } from "./memoriesTypes";

/**
 * 将记忆结构格式化为人类可读的文本（用于展示和 prompt 注入）
 */
export function formatMemories(memories: Memories): string {
  const parts: string[] = [];

  // Timeline
  if (memories.timeline.length > 0) {
    parts.push("## 关系时间线");
    for (const event of memories.timeline) {
      const dateStr = event.date ? ` (${event.date})` : "";
      parts.push(`- ${event.description}${dateStr}`);
    }
  }

  // Daily Rituals
  if (memories.dailyRituals.length > 0) {
    parts.push("\n## 日常仪式");
    for (const ritual of memories.dailyRituals) {
      const freq = ritual.frequency ? `【${ritual.frequency}】` : "";
      parts.push(`- ${freq} ${ritual.name}: ${ritual.description}`);
    }
  }

  // Preferences
  if (memories.preferences.length > 0) {
    parts.push("\n## 她的偏好");
    for (const pref of memories.preferences) {
      const conf = pref.confidence === "high" ? "★" : pref.confidence === "medium" ? "☆" : "?";
      parts.push(`- ${conf} [${pref.category}] ${pref.detail}`);
    }
  }

  // Emotional Patterns
  if (memories.emotionalPatterns.length > 0) {
    parts.push("\n## 情感模式");
    for (const pattern of memories.emotionalPatterns) {
      parts.push(`- 当 ${pattern.trigger} 时，她会 ${pattern.herReaction}，你通常 ${pattern.yourTypicalResponse}，结果 ${pattern.outcome}`);
    }
  }

  // Conflict Patterns
  if (memories.conflictPatterns.length > 0) {
    parts.push("\n## 冲突模式");
    for (const conflict of memories.conflictPatterns) {
      parts.push(`- 关于「${conflict.topic}」: ${conflict.howItStarts} → ${conflict.howItEscalates} → ${conflict.howItResolves}`);
    }
  }

  // Key Phrases
  if (memories.keyPhrases.length > 0) {
    parts.push("\n## 她的标志话语");
    parts.push(memories.keyPhrases.map((p) => `- "${p}"`).join("\n"));
  }

  return parts.join("\n") || "(暂无共同记忆)";
}

/**
 * 生成轻量版记忆摘要（用于列表展示，不超过 200 字）
 */
export function summarizeMemories(memories: Memories): string {
  const items: string[] = [];

  if (memories.timeline.length > 0) {
    items.push(`${memories.timeline.length} 个重要时刻`);
  }
  if (memories.dailyRituals.length > 0) {
    items.push(`${memories.dailyRituals.length} 个日常习惯`);
  }
  if (memories.preferences.length > 0) {
    items.push(`${memories.preferences.length} 个偏好`);
  }
  if (memories.emotionalPatterns.length > 0) {
    items.push(`${memories.emotionalPatterns.length} 个情感模式`);
  }

  if (items.length === 0) return "暂无共同记忆";
  return items.join("、");
}

/**
 * 生成用于 AI 上下文的记忆摘要（精简版，注入到系统 prompt）
 */
export function buildMemoriesContext(memories: Memories, maxLength = 800): string {
  const full = formatMemories(memories);
  if (full.length <= maxLength) return full;

  // 超出长度时，优先保留情感模式和冲突模式（对对话质量影响最大）
  const critical = [
    "## 情感模式",
    "## 冲突模式",
    "## 日常仪式",
  ];

  const lines = full.split("\n");
  const result: string[] = [];
  let currentSection = "";
  let charCount = 0;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      currentSection = line;
    }
    // 关键 section 优先保留
    if (critical.some((c) => currentSection.includes(c)) || charCount < maxLength) {
      result.push(line);
      charCount += line.length + 1;
    }
  }

  return result.join("\n");
}
