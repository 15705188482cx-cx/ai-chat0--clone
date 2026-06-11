export interface RawMessage {
  senderName: string;
  content: string;
  timestamp: Date;
  type: "text" | "image" | "video" | "system" | "unknown";
}

export interface ParsedSession {
  sessionId: string;
  messages: RawMessage[];
  participants: string[];
  startTime: Date;
  endTime: Date;
}

export interface ParseResult {
  sessions: ParsedSession[];
  totalMessages: number;
  participants: string[];
  timeSpan: { start: Date; end: Date };
  ignoredCount: number;
}
