import fs from "node:fs";
import path from "node:path";
import { parseHtmlFormat } from "../../src/modules/chatParser/strategies/wechatHtmlParser";

const FIXTURES = path.join(__dirname, "..", "fixtures");

describe("wechatHtmlParser", () => {
  // ============================================================================
  // 策略1: message div 块结构解析 (WechatExporter 主要格式)
  // ============================================================================
  it("解析 message div 块格式 (策略1)", () => {
    const html = fs.readFileSync(
      path.join(FIXTURES, "sample_wechat.html"),
      "utf-8",
    );
    const result = parseHtmlFormat(html);

    expect(result).toHaveLength(3);
    expect(result[0].senderName).toBe("张三");
    expect(result[0].content).toBe("今天吃什么");
    expect(result[0].type).toBe("text");
    expect(result[0].timestamp).toBeInstanceOf(Date);

    expect(result[1].senderName).toBe("李四");
    expect(result[1].content).toBe("火锅呀，你呢？");

    expect(result[2].senderName).toBe("张三");
    expect(result[2].content).toBe("我也是，一起去吧");
  });

  // ============================================================================
  // 策略3: 结构化文本行解析 (简化版 HTML)
  // ============================================================================
  it("解析结构化文本行格式 (策略3)", () => {
    const html = fs.readFileSync(
      path.join(FIXTURES, "sample_wechat_lines.html"),
      "utf-8",
    );
    const result = parseHtmlFormat(html);

    expect(result.length).toBeGreaterThanOrEqual(4);

    // 验证第一条消息
    const firstMsg = result.find(m => m.content === "今天吃什么");
    expect(firstMsg).toBeDefined();
    expect(firstMsg!.senderName).toBe("张三");

    // 验证上午时间解析
    const morningMsg = result.find(m => m.content === "早上好！");
    expect(morningMsg).toBeDefined();
    const morningHour = morningMsg!.timestamp.getHours();
    expect(morningHour).toBe(8);
  });

  // ============================================================================
  // 边界条件: 空输入
  // ============================================================================
  it("处理空字符串", () => {
    const result = parseHtmlFormat("");
    expect(result).toHaveLength(0);
  });

  // ============================================================================
  // 边界条件: 无有效消息的 HTML
  // ============================================================================
  it("处理无有效消息的 HTML", () => {
    const result = parseHtmlFormat("<html><body><div>Hello</div></body></html>");
    expect(result).toHaveLength(0);
  });

  // ============================================================================
  // 边界条件: 过滤系统消息和媒体占位符
  // ============================================================================
  it("过滤 [图片] 等媒体占位符", () => {
    // 策略3会通过lineRegex匹配到 "[图片]" 行并过滤掉
    const html = `2024-01-15 下午 2:30:45 张三: [图片]
2024-01-15 下午 2:31:00 李四: 好的`;
    const result = parseHtmlFormat(html);
    // [图片] 应该被过滤，只有 "好的" 
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("好的");
  });

  // ============================================================================
  // 边界条件: AM/PM 时间格式
  // ============================================================================
  it("解析 AM/PM 格式时间", () => {
    const html = `2024-01-15 2:30:45 PM 张三: 下午茶时间
2024-01-15 8:30:00 AM 李四: 早上好`;
    const result = parseHtmlFormat(html);

    expect(result).toHaveLength(2);
    // PM 2:30 → 14:30
    const pmMsg = result.find(m => m.content === "下午茶时间");
    expect(pmMsg).toBeDefined();
    expect(pmMsg!.timestamp.getHours()).toBe(14);

    // AM 8:30 → 8:30
    const amMsg = result.find(m => m.content === "早上好");
    expect(amMsg).toBeDefined();
    expect(amMsg!.timestamp.getHours()).toBe(8);
  });

  // ============================================================================
  // 边界条件: 多行消息内容
  // ============================================================================
  it("保留消息中的换行符", () => {
    const html = `<div class="message">
  <div class="sender">张三</div>
  <div class="content">第一行<br>第二行<br/>第三行</div>
  <div class="time">2024-01-15 下午 2:30:45</div>
</div>`;
    const result = parseHtmlFormat(html);

    expect(result).toHaveLength(1);
    expect(result[0].content).toContain("第一行");
    expect(result[0].content).toContain("第二行");
    expect(result[0].content).toContain("第三行");
  });

  // ============================================================================
  // 边界条件: 无效时间戳被跳过
  // ============================================================================
  it("跳过无效时间戳的消息", () => {
    const html = `2024-13-99 下午 2:30:45 张三: 无效时间
2024-01-15 下午 2:30:45 李四: 有效消息`;
    const result = parseHtmlFormat(html);

    // 无效日期的消息被跳过
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("有效消息");
  });

  // ============================================================================
  // 边界条件: 中文时间表述变体（凌晨、中午、早上、傍晚、晚上）
  // ============================================================================
  it("解析中文时间表述变体", () => {
    const html = `2024-01-15 凌晨 3:30:00 张三: 凌晨消息
2024-01-15 中午 12:00:00 李四: 中午消息
2024-01-15 傍晚 6:00:00 张三: 傍晚消息`;
    const result = parseHtmlFormat(html);

    expect(result).toHaveLength(3);
    const dawn = result.find(m => m.content === "凌晨消息");
    expect(dawn!.timestamp.getHours()).toBe(3);

    const noon = result.find(m => m.content === "中午消息");
    expect(noon!.timestamp.getHours()).toBe(12);

    const dusk = result.find(m => m.content === "傍晚消息");
    // 傍晚6点 in Chinese period handling: 傍晚 or 晚上 sets PM
    expect(dusk!.timestamp.getHours()).toBe(18);
  });
});
