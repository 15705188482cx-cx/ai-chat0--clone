import type { ParseResult } from "./types";
import { parseTxtFormat } from "./strategies/txtParser";
import { parseJsonFormat } from "./strategies/jsonParser";
import { cleanMessages } from "./messageCleaner";
import { splitIntoSessions } from "./sessionSplitter";

export function parseChatFile(
  content: string,
  fileType: "txt" | "json",
): ParseResult {
  const rawMessages =
    fileType === "json" ? parseJsonFormat(content) : parseTxtFormat(content);

  const cleaned = cleanMessages(rawMessages);
  const sessions = splitIntoSessions(cleaned);

  const participants = [...new Set(cleaned.map((m) => m.senderName))];

  return {
    sessions,
    totalMessages: cleaned.length,
    participants,
    timeSpan: {
      start: cleaned[0]?.timestamp ?? new Date(),
      end: cleaned[cleaned.length - 1]?.timestamp ?? new Date(),
    },
    ignoredCount: rawMessages.length - cleaned.length,
  };
}
