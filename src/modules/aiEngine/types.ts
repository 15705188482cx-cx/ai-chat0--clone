export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResponse {
  replyText: string;
  finishReason: "stop" | "length" | "error";
}
