import type { RawMessage, ParsedSession } from "./types";
import { nanoid } from "nanoid";

const SESSION_GAP_MS = 4 * 60 * 60 * 1000;

export function splitIntoSessions(messages: RawMessage[]): ParsedSession[] {
  if (messages.length === 0) return [];

  const sorted = [...messages].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );

  const sessions: ParsedSession[] = [];
  let currentBatch: RawMessage[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const gap =
      sorted[i].timestamp.getTime() -
      currentBatch[currentBatch.length - 1].timestamp.getTime();
    if (gap > SESSION_GAP_MS) {
      sessions.push(buildSession(currentBatch));
      currentBatch = [sorted[i]];
    } else {
      currentBatch.push(sorted[i]);
    }
  }
  sessions.push(buildSession(currentBatch));
  return sessions;
}

function buildSession(messages: RawMessage[]): ParsedSession {
  const participants = [...new Set(messages.map((m) => m.senderName))];
  return {
    sessionId: nanoid(),
    messages,
    participants,
    startTime: messages[0].timestamp,
    endTime: messages[messages.length - 1].timestamp,
  };
}
