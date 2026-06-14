// =============================================================================
// Memories types - ex.skill 记忆提取数据结构
// 对应 ex.skill 的 memories.md 输出
// =============================================================================

/** 关系时间线节点 */
export interface TimelineEvent {
  date?: string;
  description: string;
  category: "milestone" | "daily" | "conflict" | "travel" | "other";
}

/** 日常仪式 */
export interface DailyRitual {
  name: string;
  description: string;
  frequency?: string; // 每天/每周/偶尔
}

/** 偏好习惯 */
export interface Preference {
  category: string; // 食物/娱乐/出行/礼物/...
  detail: string;
  evidence?: string; // 从聊天记录中推断的依据
  confidence: "high" | "medium" | "low";
}

/** 情感模式 */
export interface EmotionalPattern {
  trigger: string; // 触发条件
  herReaction: string; // 她的反应
  yourTypicalResponse: string; // 你通常怎么回应
  outcome: string; // 结果
}

/** 冲突模式 */
export interface ConflictPattern {
  topic: string; // 吵架话题
  howItStarts: string; // 怎么开始的
  howItEscalates: string; // 怎么升级的
  howItResolves: string; // 怎么和好的
}

/** 记忆元数据 */
export interface MemoriesMeta {
  version: number;
  createdAt: string;
  updatedAt: string;
  sourceCount: number; // 分析的聊天记录条数
  lastSourceId?: string; // 最后分析的批次 ID
}

/** 完整记忆结构 */
export interface Memories {
  meta: MemoriesMeta;
  timeline: TimelineEvent[];
  dailyRituals: DailyRitual[];
  preferences: Preference[];
  emotionalPatterns: EmotionalPattern[];
  conflictPatterns: ConflictPattern[];
  keyPhrases: string[]; // 她常说的关键话语
  rawSummary: string; // AI 原始分析摘要（用于后续 merge）
}
