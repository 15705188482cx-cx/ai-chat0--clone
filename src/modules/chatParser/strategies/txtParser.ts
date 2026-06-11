import type { RawMessage } from "../types";

const TXT_MSG_REGEX = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(.+?)$/;

export function parseTxtFormat(content: string): RawMessage[] {
  const lines = content.split("\n");
  const messages: RawMessage[] = [];
  let currentSender = "";
  let currentTime: Date | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const match = line.match(TXT_MSG_REGEX);
    if (match) {
      if (currentSender && currentLines.length > 0) {
        messages.push({
          senderName: currentSender,
          content: currentLines.join("\n").trim(),
          timestamp: currentTime!,
          type: "text",
        });
      }
      currentTime = new Date(match[1]);
      currentSender = match[2].trim();
      currentLines = [];
    } else {
      if (currentSender) {
        currentLines.push(line);
      }
    }
  }

  if (currentSender && currentLines.length > 0) {
    messages.push({
      senderName: currentSender,
      content: currentLines.join("\n").trim(),
      timestamp: currentTime!,
      type: "text",
    });
  }

  return messages;
}
