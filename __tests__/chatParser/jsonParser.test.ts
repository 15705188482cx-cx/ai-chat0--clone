import { parseJsonFormat } from "../../src/modules/chatParser/strategies/jsonParser";

describe("jsonParser", () => {
  it("解析标准 JSON 数组格式", () => {
    const input = JSON.stringify([
      {
        role: "user",
        sender_name: "张三",
        content: "今天吃什么",
        time: "2024-01-01 12:00:00",
        type: "text",
      },
      {
        role: "friend",
        sender_name: "李四",
        content: "火锅呀",
        time: "2024-01-01 12:01:00",
        type: "text",
      },
    ]);

    const result = parseJsonFormat(input);
    expect(result).toHaveLength(2);
    expect(result[0].senderName).toBe("张三");
    expect(result[0].content).toBe("今天吃什么");
  });

  it("保留非 text 类型消息（过滤由 messageCleaner 统一处理）", () => {
    const input = JSON.stringify([
      { sender_name: "张三", content: "[图片]", time: "2024-01-01 12:00:00", type: "image" },
      { sender_name: "李四", content: "好的", time: "2024-01-01 12:01:00", type: "text" },
    ]);

    const result = parseJsonFormat(input);
    // jsonParser 不再过滤，返回所有消息（包括 image）
    expect(result).toHaveLength(2);
  });

  it("处理空数组", () => {
    const result = parseJsonFormat("[]");
    expect(result).toHaveLength(0);
  });

  it("兼容缺少 type 字段的消息", () => {
    const input = JSON.stringify([
      { sender_name: "张三", content: "你好", time: "2024-01-01 12:00:00" },
    ]);

    const result = parseJsonFormat(input);
    expect(result).toHaveLength(1);
  });
});
