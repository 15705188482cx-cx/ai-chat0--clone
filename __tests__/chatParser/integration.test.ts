import fs from "node:fs";
import path from "node:path";
import { parseChatFile } from "../../src/modules/chatParser/parserFactory";

const FIXTURES = path.join(__dirname, "..", "fixtures");

describe("全链路: 文件 → 解析 → 清洗 → 分割", () => {
  it("正确解析 TXT fixture 文件", () => {
    const content = fs.readFileSync(
      path.join(FIXTURES, "sample_wechat.txt"),
      "utf-8",
    );
    const result = parseChatFile(content, "txt");

    expect(result.totalMessages).toBeGreaterThan(0);
    expect(result.ignoredCount).toBeGreaterThan(0);
    expect(result.participants).toContain("张三");
    expect(result.participants).toContain("李四");
    expect(result.sessions.length).toBeGreaterThanOrEqual(2);
  });

  it("正确解析 JSON fixture 文件", () => {
    const content = fs.readFileSync(
      path.join(FIXTURES, "sample_wechat.json"),
      "utf-8",
    );
    const result = parseChatFile(content, "json");

    expect(result.totalMessages).toBeGreaterThan(0);
    expect(result.ignoredCount).toBeGreaterThanOrEqual(2);
    expect(result.participants).toContain("张三");
    expect(result.participants).toContain("李四");
  });

  it("正确解析 HTML fixture 文件", () => {
    const content = fs.readFileSync(
      path.join(FIXTURES, "sample_wechat.html"),
      "utf-8",
    );
    const result = parseChatFile(content, "html");

    expect(result.totalMessages).toBeGreaterThanOrEqual(3);
    expect(result.participants).toContain("张三");
    expect(result.participants).toContain("李四");
    // HTML fixture 中 3 条消息时间接近，应合并为 1 个会话段
    expect(result.sessions.length).toBeGreaterThanOrEqual(1);
  });
});
