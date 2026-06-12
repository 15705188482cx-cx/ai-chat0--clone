import type { ChatMessage } from "./types";
import { getApiKey } from "../config/apiKeyManager";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const DEEPSEEK_MODEL = "deepseek-chat";

/**
 * 使用原生 fetch 调用 DeepSeek API（非流式）
 * 避免 OpenAI SDK 在浏览器环境中的兼容性问题
 */
async function rawChatCompletion(
  messages: ChatMessage[],
  options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    timeout?: number;
  } = {},
): Promise<string> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error("API Key 未配置，请在设置页输入 DeepSeek API Key");

  const {
    model = DEEPSEEK_MODEL,
    temperature = 0.8,
    max_tokens = 500,
    timeout = 30000,
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(DEEPSEEK_BASE_URL + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature,
        max_tokens,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      const errorMsg = "API 错误 (" + response.status + "): " + (errorBody.slice(0, 200) || response.statusText);
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("API 返回格式异常: 缺少 choices[0].message.content");
    }
    return content;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("API 请求超时，请检查网络或 API Key 是否有效");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 原生 fetch 流式调用
 */
export async function* streamChat(
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error("API Key 未配置");

  const response = await fetch(DEEPSEEK_BASE_URL + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: 0.8,
      max_tokens: 300,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error("Stream API 错误: " + response.status);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response body 不可读");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") continue;
      if (!trimmed.startsWith("data: ")) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const delta = json?.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch (err) { console.warn("[deepseekService] streamChat JSON 解析失败，跳过该行:", err); }
    }
  }
}

/**
 * 非流式聊天（旧版兼容，直接用原生 fetch）
 */
export async function chatNonStreaming(messages: ChatMessage[]): Promise<string> {
  return rawChatCompletion(messages, { timeout: 25000 });
}

