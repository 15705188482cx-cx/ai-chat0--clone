import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "..", "config.json");

const DEFAULT_CONFIG = {
  apiBase: "https://api.deepseek.com/v1",
  apiKey: "",
  model: "deepseek-chat",
  maxTokens: 4000,
  temperature: 0.7,
};

export function loadConfig() {
  if (existsSync(CONFIG_PATH)) {
    try {
      const saved = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
      return {
        ...saved,
        apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || saved.apiKey || "",
      };
    } catch { /* fall through */ }
  }
  return {
    ...DEFAULT_CONFIG,
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || "",
  };
}

export function saveConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

export function showConfigSummary(config) {
  if (!config) config = loadConfig();
  console.log("\n\u{1F4CB} 当前配置");
  console.log("  API 地址:", config.apiBase);
  console.log("  API Key:", config.apiKey ? config.apiKey.slice(0, 8) + "..." + config.apiKey.slice(-4) : "\u274C 未设置");
  console.log("  模型:", config.model);
  console.log("  Max Tokens:", config.maxTokens);
  console.log("  Temperature:", config.temperature);
}
