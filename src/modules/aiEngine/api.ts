import { chatNonStreaming } from "./deepseekService";
import type { ChatMessage } from "./types";

/**
 * 调用 LLM 处理非对话用途的查询（纠正、分析等）
 * 复用 deepseekService 的 API 配置
 */
export async function callLLM(messages: ChatMessage[]): Promise<string> {
  const result = await chatNonStreaming(messages);
  return result || "";
}
