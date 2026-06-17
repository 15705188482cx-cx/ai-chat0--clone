/**
 * autoSetup 单元测试
 */
import { BUNDLED_CHAT_DATA, BUNDLED_RECORD_COUNT } from '../src/modules/testData/bundledTestData';
import { parseChatFile } from '../src/modules/chatParser/parserFactory';

describe('autoSetup data validation', () => {
  it('BUNDLED_CHAT_DATA 可被 parseChatFile 解析', () => {
    const result = parseChatFile(JSON.stringify(BUNDLED_CHAT_DATA), 'json');
    expect(result.totalMessages).toBeGreaterThan(0);
    expect(result.participants.length).toBeGreaterThanOrEqual(1);
  });

  it('解析后至少有一个参与者不是"我"', () => {
    const result = parseChatFile(JSON.stringify(BUNDLED_CHAT_DATA), 'json');
    const hasOther = result.participants.some((p) => p !== '我');
    expect(hasOther).toBe(true);
  });

  it('BUNDLED_RECORD_COUNT 与文件长度一致', () => {
    expect(BUNDLED_RECORD_COUNT).toBe(BUNDLED_CHAT_DATA.length);
  });

  it('所有记录的时间戳格式正确', () => {
    BUNDLED_CHAT_DATA.forEach((r) => {
      const d = new Date(r.time.replace(' ', 'T') + '+08:00');
      expect(d.getTime()).not.toBeNaN();
    });
  });

  it('非 text 类型的记录会被 parser 过滤', () => {
    const textOnly = BUNDLED_CHAT_DATA.filter((r) => r.type !== 'text');
    const result = parseChatFile(JSON.stringify(BUNDLED_CHAT_DATA), 'json');
    const expectedTotal = BUNDLED_RECORD_COUNT - textOnly.length;
    expect(result.totalMessages).toBe(expectedTotal);
  });
});
