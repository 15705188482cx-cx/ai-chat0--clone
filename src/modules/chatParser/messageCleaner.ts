import type { RawMessage } from "./types";

const SYSTEM_PATTERNS = [
  /^你已添加了.*为好友/,
  /^你邀请.*加入了群聊/,
  /^以上是打招呼的内容/,
  /^\d{4}年\d{1,2}月\d{1,2}日/,
  /^\[.*\]$/,
];

export function cleanMessages(messages: RawMessage[]): RawMessage[] {
  return messages.filter((msg) => {
    if (!msg.content || msg.content.trim().length === 0) return false;
    if (msg.type !== "text") return false;
    return !SYSTEM_PATTERNS.some((p) => p.test(msg.content.trim()));
  });
}

export function shouldIgnore(msg: RawMessage): boolean {
  return !cleanMessages([msg]).length;
}
