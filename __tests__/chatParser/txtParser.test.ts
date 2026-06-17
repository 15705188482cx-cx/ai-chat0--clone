import { parseTxtFormat } from "../../src/modules/chatParser/strategies/txtParser";
import { cleanMessages } from "../../src/modules/chatParser/messageCleaner";
import type { RawMessage } from "../../src/modules/chatParser/types";

function makeMsg(
  senderName: string,
  content: string,
  type: RawMessage["type"] = "text",
): RawMessage {
  return { senderName, content, timestamp: new Date(), type };
}

describe("txtParser", () => {
  it("解析标准 TXT 格式", () => {
    const input = `2024-01-01 12:00:00 张三
今天吃什么

2024-01-01 12:01:00 李四
火锅呀，你呢？

2024-01-01 12:02:00 张三
我也是，一起去吧`;

    const result = parseTxtFormat(input);
    expect(result).toHaveLength(3);
    expect(result[0].senderName).toBe("张三");
    expect(result[0].content).toBe("今天吃什么");
    expect(result[1].senderName).toBe("李四");
  });

  it("处理多行消息", () => {
    const input = `2024-01-01 12:00:00 张三
第一行
第二行
第三行

2024-01-01 12:01:00 李四
好的`;

    const result = parseTxtFormat(input);
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("第一行\n第二行\n第三行");
  });

  it("处理空文件", () => {
    const result = parseTxtFormat("");
    expect(result).toHaveLength(0);
  });
});

describe("messageCleaner", () => {
  it("过滤系统消息", () => {
    const messages: RawMessage[] = [
      makeMsg("系统", "你已添加了张三为好友"),
      makeMsg("李四", "你好"),
    ];
    const cleaned = cleanMessages(messages);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].content).toBe("你好");
  });

  it("过滤空消息和非文本类型", () => {
    const messages: RawMessage[] = [
      makeMsg("张三", ""),
      makeMsg("李四", "你好", "image"),
    ];
    const cleaned = cleanMessages(messages);
    expect(cleaned).toHaveLength(0);
  });
});
