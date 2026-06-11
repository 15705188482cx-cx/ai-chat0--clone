import type { RawMessage } from "../types";

interface JsonMessageEntry {
  sender_name?: string;
  senderName?: string;
  content?: string;
  text?: string;
  time?: string;
  timestamp?: string;
  created_at?: string;
  type?: string;
}

export function parseJsonFormat(content: string): RawMessage[] {
  const data: unknown = JSON.parse(content);
  const arr: JsonMessageEntry[] = Array.isArray(data)
    ? (data as JsonMessageEntry[])
    : ((data as { messages?: JsonMessageEntry[] }).messages ?? []);
  return arr
    .map((m: JsonMessageEntry) => ({
      senderName: m.sender_name || m.senderName || "未知",
      content: m.content || m.text || "",
      timestamp: new Date(m.time || m.timestamp || m.created_at || Date.now()),
      type: (m.type as RawMessage["type"]) || "text",
    }));
}
