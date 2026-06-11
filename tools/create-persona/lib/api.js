import { loadConfig } from "./config.js";

export async function callLLM(messages, options = {}) {
  const config = loadConfig();
  const url = `${config.apiBase}/chat/completions`;

  const body = {
    model: options.model || config.model,
    messages,
    max_tokens: options.maxTokens || config.maxTokens,
    temperature: options.temperature ?? config.temperature,
    stream: false,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API 调用失败 (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}
