// =============================================================================
// bundledTestData - 内嵌的测试聊天数据(用于首启动 onboarding 和本地演示)
// 规则 6(最小实现): 只内嵌 quick 版(50 条 / 6KB),不内嵌 full 版
// 数据来源: test-data/chat_quick.json (恋人场景 2024-03-25 ~ 2024-03-31)
// =============================================================================

import bundledChatData from '../../assets/test-data/chat_quick.json';

export interface BundledChatRecord {
  sender_name: string;
  content: string;
  time: string;
  type: 'text' | 'image';
}

/**
 * 内嵌的聊天数据,Web / Native 通用 (Metro 打包进 JS bundle)。
 * 50 条记录,发送者仅为 "我" 或 "她"。
 */
export const BUNDLED_CHAT_DATA: BundledChatRecord[] =
  bundledChatData as BundledChatRecord[];

/** 内嵌数据规模(便于测试断言) */
export const BUNDLED_RECORD_COUNT = BUNDLED_CHAT_DATA.length;
