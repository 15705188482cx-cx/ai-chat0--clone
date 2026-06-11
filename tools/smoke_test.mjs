/**
 * 全链路 Smoke Test（纯 Node.js 脚本，绕过 Jest HTTP 兼容问题）
 * 运行方式：node tools/smoke_test.mjs
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "..", "__tests__", "fixtures");

const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey || apiKey === "your_key_here") {
  console.error("ERROR: DEEPSEEK_API_KEY 未配置，请在 .env 文件中填入 API Key");
  process.exit(1);
}

const client = new OpenAI({
  apiKey,
  baseURL: "https://api.deepseek.com/v1",
  timeout: 30000,
});

async function main() {
  console.log("=".repeat(50));
  console.log("AI 聊天分身 — 全链路 Smoke Test");
  console.log("=".repeat(50));

  // ---- Step 1: Read and parse TXT fixture ----
  console.log("\n[1/6] 解析 TXT fixture 文件...");
  const txtContent = fs.readFileSync(
    path.join(FIXTURES, "sample_wechat.txt"),
    "utf-8",
  );

  const msgRegex = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(.+?)$/;
  const lines = txtContent.split("\n");
  const messages = [];
  let currentSender = "";
  let currentTime = null;
  let currentLines = [];

  for (const line of lines) {
    const match = line.match(msgRegex);
    if (match) {
      if (currentSender && currentLines.length > 0) {
        messages.push({ sender: currentSender, content: currentLines.join("\n").trim(), time: currentTime });
      }
      currentTime = match[1];
      currentSender = match[2].trim();
      currentLines = [];
    } else if (currentSender) {
      currentLines.push(line);
    }
  }
  if (currentSender && currentLines.length > 0) {
    messages.push({ sender: currentSender, content: currentLines.join("\n").trim(), time: currentTime });
  }

  const systemPatterns = [/^你已添加了.*为好友/, /^\[.*\]$/];
  const textMessages = messages.filter((m) => {
    if (!m.content.trim()) return false;
    return !systemPatterns.some((p) => p.test(m.content.trim()));
  });

  const senders = [...new Set(textMessages.map((m) => m.sender))];
  console.log(`  ✓ 消息总数: ${textMessages.length}`);
  console.log(`  ✓ 参与人数: ${senders.length} (${senders.join(", ")})`);

  // ---- Step 2: Select persona source ----
  console.log("\n[2/6] 选择分身目标...");
  const target = "张三";
  const targetMsgs = textMessages.filter((m) => m.sender === target);
  console.log(`  ✓ 目标: ${target}, 消息数: ${targetMsgs.length}`);
  console.log(`  ✓ 样本: "${targetMsgs.slice(0, 3).map((m) => m.content).join(" | ")}"`);

  // ---- Step 3: Build Persona ----
  console.log("\n[3/6] 构建 Persona...");
  const styleSummary = "句子偏短，常用'哈哈'和'嗯嗯'，喜欢用感叹号";

  // ---- Step 4: Build Prompt ----
  console.log("\n[4/6] 组装 Prompt...");
  const samples = targetMsgs.slice(0, 10).map((m) => `${m.sender}: ${m.content}`);
  const systemPrompt = `你是${target}，以下是你的说话风格分析：\n\n${styleSummary}\n\n你需要严格模仿以上风格。不要承认自己是AI。`;
  const fewShot = `以下是${target}的真实聊天记录：\n\n${samples.join("\n---\n")}\n\n--- 以上为参考，以下为当前对话 ---`;
  const userInput = "最近怎么样啊，有什么好玩的吗？";

  const apiMessages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: fewShot },
    { role: "user", content: `<user_message>${userInput}</user_message>` },
  ];

  console.log(`  ✓ System Prompt: ${systemPrompt.length} 字符`);
  console.log(`  ✓ 用户输入: "${userInput}"`);

  // ---- Step 5: Call DeepSeek ----
  console.log("\n[5/6] 调用 DeepSeek API...");
  let reply = "";
  try {
    const response = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: apiMessages,
      temperature: 0.8,
      max_tokens: 300,
    });
    reply = response.choices[0]?.message?.content ?? "";
    console.log(`  AI 回复: "${reply}"`);
  } catch (err) {
    console.log(`  ✗ API 调用失败: ${err.message}`);
    if (err.status) console.log(`    HTTP 状态码: ${err.status}`);
    process.exit(1);
  }

  // ---- Step 6: Verify ----
  console.log("\n[6/6] 验证结果...");
  const checks = [
    { label: "回复非空", pass: reply.length > 0 },
    { label: "包含中文", pass: /[\u4e00-\u9fff]/.test(reply) },
    { label: "无AI身份声明", pass: !/作为AI|我是一个AI|人工智能/.test(reply) },
  ];
  for (const c of checks) {
    console.log(`  ${c.pass ? "✓" : "✗"} ${c.label}`);
  }
  const allPass = checks.every((c) => c.pass);
  console.log(`\n${"=".repeat(50)}`);
  console.log(`${allPass ? "✓ Smoke test 全部通过" : "✗ 部分检查未通过"}`);
  console.log("=".repeat(50));
  process.exit(allPass ? 0 : 1);
}

main();
