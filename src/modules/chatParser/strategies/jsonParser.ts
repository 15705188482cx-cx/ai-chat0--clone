import type { RawMessage } from "../types";

interface JsonMessageEntry {
  sender_name?: string;
  senderName?: string;
  /** wechat-decrypt: 1-on-1 为联系人名，群聊为群成员名，"me" 表示自己 */
  sender?: string;
  content?: string;
  text?: string;
  time?: string;
  /** wechat-decrypt: Unix 秒级时间戳 (number) */
  timestamp?: string | number;
  created_at?: string | number;
  type?: string;
}

/**
 * 兼容 wechat-decrypt 的 JSON 导出格式：
 *   { "messages": [ { "sender": "me"/"<name>", "timestamp": 1713..., "content": "..." } ] }
 * 以及标准 AI Chat Clone 格式：
 *   [ { "sender_name": "她", "time": "2024-03-25 09:02:45", "content": "..." } ]
 */
export function parseJsonFormat(content: string): RawMessage[] {
  const data: unknown = JSON.parse(content);
  const arr: JsonMessageEntry[] = Array.isArray(data)
    ? (data as JsonMessageEntry[])
    : ((data as { messages?: JsonMessageEntry[] }).messages ?? []);
  return arr
    .map((m: JsonMessageEntry) => {
      // wechat-decrypt: 将 "me" 映射为用户自己的名字
      let senderName = m.sender_name || m.senderName || m.sender || "未知";
      if (senderName === "me") senderName = "我";

      // wechat-decrypt: 兼容 Unix 秒级数字时间戳
      let ts: Date;
      if (m.time) {
        ts = new Date(m.time);
      } else if (m.timestamp != null) {
        ts = typeof m.timestamp === "number"
          ? new Date(m.timestamp * 1000)
          : new Date(m.timestamp);
      } else if (m.created_at != null) {
        ts = typeof m.created_at === "number"
          ? new Date(m.created_at * 1000)
          : new Date(m.created_at);
      } else {
        ts = new Date();
      }

      return {
        senderName,
        content: m.content || m.text || "",
        timestamp: ts,
        type: (m.type as RawMessage["type"]) || "text",
      };
    });
}
