/**
 * onboarding 集成测试
 * 验证 autoSetup 能正确消费 BUNDLED_CHAT_DATA 并解析出有效会话。
 * 完整的 autoSetup 执行需要 IDatabase + DeepSeek API,这部分在 CI 中由 mock 覆盖。
 */
import { BUNDLED_CHAT_DATA } from '../src/modules/testData/bundledTestData';
import { parseChatFile } from '../src/modules/chatParser/parserFactory';
import { getConversationPairs } from '../src/modules/database/repositories/chatRecordRepo';

describe('onboarding data integration', () => {
  it('BUNDLED_CHAT_DATA 可解析为聊天记录', () => {
    const result = parseChatFile(JSON.stringify(BUNDLED_CHAT_DATA), 'json');
    expect(result.totalMessages).toBeGreaterThanOrEqual(49);
    expect(result.participants.includes('她')).toBe(true);
    expect(result.sessions.length).toBeGreaterThanOrEqual(1);
  });

  it('解析结果包含会话(sessions)', () => {
    const result = parseChatFile(JSON.stringify(BUNDLED_CHAT_DATA), 'json');
    expect(Array.isArray(result.sessions)).toBe(true);
    expect(result.sessions.length).toBeGreaterThan(0);
    result.sessions.forEach((s) => {
      expect(s.messages.length).toBeGreaterThan(0);
      expect(s.participants.length).toBeGreaterThan(0);
    });
  });

  it('清洗后的消息不含 type=image', () => {
    const imageCount = BUNDLED_CHAT_DATA.filter((r) => r.type !== 'text').length;
    const result = parseChatFile(JSON.stringify(BUNDLED_CHAT_DATA), 'json');
    expect(result.ignoredCount).toBe(imageCount);
  });
});
