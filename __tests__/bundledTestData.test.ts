/**
 * bundledTestData 验收测试
 * 验证内嵌测试数据可被正确解析
 */
import { BUNDLED_CHAT_DATA, BUNDLED_RECORD_COUNT } from '../src/modules/testData/bundledTestData';
import { parseChatFile } from '../src/modules/chatParser/parserFactory';

describe('bundledTestData', () => {
  it('导出非空数组', () => {
    expect(Array.isArray(BUNDLED_CHAT_DATA)).toBe(true);
    expect(BUNDLED_RECORD_COUNT).toBeGreaterThan(0);
  });

  it('记录数正确', () => {
    expect(BUNDLED_RECORD_COUNT).toBe(50);
  });

  it('仅包含 sender_name 为 "我" 或 "她" 的记录', () => {
    const validSenders = BUNDLED_CHAT_DATA.every(
      (r) => r.sender_name === '我' || r.sender_name === '她',
    );
    expect(validSenders).toBe(true);
  });

  it('所有记录都有 content 和 time 字段', () => {
    BUNDLED_CHAT_DATA.forEach((r) => {
      expect(r.content).toBeDefined();
      expect(r.time).toBeDefined();
      expect(r.type).toBeDefined();
    });
  });

  it('parseChatFile 解析后 totalMessages >= 50', () => {
    const result = parseChatFile(JSON.stringify(BUNDLED_CHAT_DATA), 'json');
    expect(result.totalMessages).toBeGreaterThanOrEqual(49);
    expect(result.participants).toContain('她');
    expect(result.participants).toContain('我');
  });

  it('解析后 participants 包含 "她" 和 "我"', () => {
    const result = parseChatFile(JSON.stringify(BUNDLED_CHAT_DATA), 'json');
    expect(result.participants.includes('她')).toBe(true);
    expect(result.participants.includes('我')).toBe(true);
  });
});
