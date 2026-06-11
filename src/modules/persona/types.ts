// 简单版 - 兼容现有数据
export interface PersonaLayer0 {
  rules: string[];     // "在什么情况下会怎么做" 的行为规则
}

export interface PersonaLayer1 {
  occupation?: string;
  mbti?: string;
  attachmentType?: string;  // 安全型/焦虑型/回避型/混乱型
  howMet?: string;          // 怎么认识的
  duration?: string;        // 在一起多久
  impression?: string;
}

export interface PersonaLayer2 {
  catchphrases: string[];     // 口头禅
  highFreqWords: string[];    // 高频词
  styleDesc: string;          // 句式特征描述
  emojiDesc: string;          // Emoji 使用描述
  scenarios: Record<string, string>;  // 场景示例 {"想你了": "她会怎么回"}
}

export interface PersonaLayer3 {
  priority: string;           // 情感优先级
  affectionTriggers: string;  // 主动表达爱的触发条件
  withdrawalTriggers: string; // 退缩触发
  dissatisfactionExpr: string; // 表达不满的方式
  responseToCriticism: string; // 面对质疑的反应
}

export interface PersonaLayer4 {
  withPartner: string;
  withHisFriends: string;
  withHerFriends: string;
  withFamily: string;
  underStress: string;
}

export interface PersonaCorrection {
  scene: string;         // 场景描述
  wrongBehavior: string; // 不应该的行为
  correctBehavior: string; // 应该的行为
  timestamp: string;
}

export interface PersonaLayers {
  layer0?: PersonaLayer0;
  layer1?: PersonaLayer1;
  layer2?: PersonaLayer2;
  layer3?: PersonaLayer3;
  layer4?: PersonaLayer4;
  layer5?: string[];      // 边界与雷区列表
}

// 升级后的 Persona 类型（兼容旧数据）
export interface Persona {
  id: string;
  name: string;
  sourceSender: string;
  chatSampleIds: string[];
  styleSummary: string;       // 旧版风格摘要（向后兼容）
  layers?: PersonaLayers;     // 新增：5 层结构
  corrections?: PersonaCorrection[];  // 新增：纠正记录
  createdAt: string;
}
