import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { loadConfig, saveConfig, showConfigSummary } from "./lib/config.js";
import { analyzePersona, analyzeMemories, analyzeStyle } from "./lib/analyzer.js";
import { buildPersonaFiles } from "./lib/builder.js";
import { handleCorrection } from "./lib/corrector.js";
import { mergeNewContent } from "./lib/merger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");

const rl = readline.createInterface({ input, output });

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function parseSlug(text) {
  // 中文转拼音简化版（取首字母拼音映射）
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff-]/g, "")
    .replace(/[\u4e00-\u9fff]/g, (ch) => {
      // 简单常用字映射
      const map = {
        "小": "xiao", "美": "mei", "糖": "tang", "宝": "bao", "贝": "bei",
        "甜": "tian", "可": "ke", "爱": "ai", "明": "ming", "月": "yue",
        "小": "xiao", "刘": "liu", "王": "wang", "张": "zhang", "李": "li",
        "陈": "chen", "周": "zhou", "黄": "huang", "吴": "wu", "赵": "zhao",
        "婷": "ting", "静": "jing", "娜": "na", "丽": "li", "娟": "juan",
        "敏": "min", "燕": "yan", "华": "hua", "红": "hong", "英": "ying",
        "杰": "jie", "强": "qiang", "军": "jun", "磊": "lei", "涛": "tao",
        "花": "hua", "雪": "xue", "云": "yun", "雨": "yu", "风": "feng",
        "星": "xing", "琪": "qi", "琳": "lin", "琪": "qi", "瑶": "yao",
        "璇": "xuan", "彤": "tong", "雯": "wen", "颖": "ying",
      };
      return map[ch] || ch;
    })
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    || "persona";
}

async function setupConfig() {
  console.log("\n=== \u2699\uFE0F 配置 API ===");
  const config = loadConfig();
  showConfigSummary(config);

  const change = await ask("\n是否修改配置？(y/n): ");
  if (change.toLowerCase() === "y") {
    config.apiBase = await ask(`API 地址 (${config.apiBase}): `) || config.apiBase;
    const key = await ask(`API Key (留空不变): `);
    if (key) config.apiKey = key;
    config.model = await ask(`模型 (${config.model}): `) || config.model;
    saveConfig(config);
    console.log("\u2705 配置已保存");
  }

  if (!config.apiKey) {
    console.log("\n\u26A0\uFE0F API Key 未设置！请在 .env 中设置 DEEPSEEK_API_KEY，或在此配置。");
    const key = await ask("输入 API Key: ");
    if (key) {
      config.apiKey = key;
      saveConfig(config);
    }
  }

  return loadConfig();
}

function listExisting() {
  if (!existsSync(OUTPUT_DIR)) return [];
  return readdirSync(OUTPUT_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const metaPath = join(OUTPUT_DIR, d.name, "meta.json");
      if (existsSync(metaPath)) {
        try {
          return { slug: d.name, ...JSON.parse(readFileSync(metaPath, "utf-8")) };
        } catch { return { slug: d.name }; }
      }
      return { slug: d.name };
    });
}

async function cmdCreate() {
  console.log("\n\u{1F9D0} === 创建 AI Persona ===");

  // Step 1: 基础信息录入
  console.log("\n\u{1F4AC} 先告诉我她的信息（每个都可以直接回车跳过）");
  const name = await ask("她的名字/昵称: ");
  if (!name) { console.log("\u274C 名字不能为空"); return; }

  const basicInfo = await ask(`用一句话描述你们的基本情况（在一起多久、怎么认识的、分手多久、她做什么的）:\n> `);
  const personalityDesc = await ask(`用一句话描述她的性格（MBTI、星座、恋爱特点、对她的印象）:\n> `);

  const slug = parseSlug(name);

  // Step 2: 选择聊天记录文件
  console.log("\n\u{1F4C2} 选择聊天记录来源");
  const sourceOption = await ask("\n[A] 从 TXT 文件导入\n[B] 从 JSON 文件导入\n[C] 直接粘贴文字内容\n[D] 跳过（仅基于描述生成）\n选择 (a/b/c/d): ");

  let samples = "";
  let styleSummary = "";

  if (["a", "A"].includes(sourceOption)) {
    const filePath = await ask("TXT 文件路径: ");
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, "utf-8");
      // 取最后 100 条消息（约 200 行）
      const lines = content.split("\n").filter(l => l.trim()).slice(-200);
      samples = lines.join("\n");
      console.log(`\u2705 已读取 ${lines.length} 行`);
    } else {
      console.log("\u274C 文件不存在");
    }
  } else if (["b", "B"].includes(sourceOption)) {
    const filePath = await ask("JSON 文件路径: ");
    if (existsSync(filePath)) {
      const json = JSON.parse(readFileSync(filePath, "utf-8"));
      const messages = Array.isArray(json) ? json : (json.messages || []);
      const lines = messages.map(m => `${m.senderName || m.sender_name || m.from}: ${m.content || m.text}`).slice(-100);
      samples = lines.join("\n");
      console.log(`\u2705 已读取 ${lines.length} 条消息`);
    } else {
      console.log("\u274C 文件不存在");
    }
  } else if (["c", "C"].includes(sourceOption)) {
    console.log("粘贴聊天内容，输入完成后输入 END 结束：");
    let lines = [];
    while (true) {
      const line = await ask("");
      if (line === "END") break;
      lines.push(line);
    }
    samples = lines.join("\n");
    console.log(`\u2705 已读取 ${lines.length} 行`);
  }

  // Step 3: 分析
  const extraInfo = [basicInfo, personalityDesc].filter(Boolean).join(" | ");
  const meta = { name, slug, basicInfo, personalityDesc };

  console.log(`\n\u{1F680} 正在分析 ${name}...\n`);

  if (samples) {
    // 有聊天记录：完整分析
    const [personaResult, memoriesResult, styleResult] = await Promise.all([
      analyzePersona(samples, name, personalityDesc),
      analyzeMemories(samples, name),
      analyzeStyle(samples, name),
    ]);

    // 展示摘要
    console.log("\n\n\u{1F4AD} === 分析摘要 ===");

    const pLayers = personaResult.layers || personaResult;
    if (pLayers.layer0 || pLayers["Layer 0"]) {
      const rules = pLayers.layer0 || pLayers["Layer 0"];
      console.log(`\n\u{1F3AF} Layer 0 - 核心规则 (${Array.isArray(rules) ? rules.length : 0} 条)`);
      if (Array.isArray(rules)) rules.slice(0, 3).forEach(r => console.log(`  \u2022 ${r}`));
    }

    if (pLayers.layer2 || pLayers["Layer 2"]) {
      const l2 = pLayers.layer2 || pLayers["Layer 2"];
      if (l2.口头禅列表?.length) console.log(`  \u{1F3AD} 口头禅: ${l2.口头禅列表.join(", ")}`);
      if (l2.高频词列表?.length) console.log(`  \u{1F4AC} 高频词: ${l2.高频词列表.join(", ")}`);
    }

    // 生成文件
    const dir = buildPersonaFiles(personaResult, memoriesResult, meta);

    // 同时保存风格摘要
    const stylePath = join(dir, "styleSummary.txt");
    writeFileSync(stylePath, styleResult, "utf-8");

    console.log(`\n\u2705 风格摘要已保存到 styleSummary.txt`);
    console.log(`\n\u2728 ${name} 的 Persona 创建完成！`);

  } else {
    // 无聊天记录：仅基于描述生成
    console.log("正在基于描述信息生成...");
    const personaResult = await analyzePersona("（用户未提供聊天记录）", name, extraInfo);
    buildPersonaFiles(personaResult, {}, meta);
    console.log(`\n\u2705 已基于描述创建 ${name} 的 Persona（建议以后追加聊天记录提升质量）`);
  }

  console.log(`\n后续命令：`);
  console.log(`  node index.js --list         查看所有 Persona`);
  console.log(`  node index.js --correct     纠正 ${name} 的行为`);
  console.log(`  node index.js --merge       为 ${name} 追加新聊天记录`);
}

async function cmdCorrect() {
  const list = listExisting();
  if (!list.length) { console.log("\u274C 还没有任何 Persona"); return; }

  console.log("\n\u{1F4CB} 已有 Persona:");
  list.forEach((p, i) => console.log(`  ${i + 1}. ${p.name || p.slug} (v${p.version || "?"})`));

  const idx = parseInt(await ask("\n选择编号: ")) - 1;
  if (idx < 0 || idx >= list.length) { console.log("\u274C 无效选择"); return; }

  const slug = list[idx].slug;
  const correction = await ask("她不会怎样？她应该是怎样的？\n> ");

  const result = await handleCorrection(slug, correction);
  if (result) {
    if (result.correctionRecord) {
      console.log(`\n\u2705 Correction 已记录：${result.correctionRecord}`);
    } else if (result.raw) {
      console.log(`\n${result.raw}`);
    }
  }
}

async function cmdMerge() {
  const list = listExisting();
  if (!list.length) { console.log("\u274C 还没有任何 Persona"); return; }

  console.log("\n\u{1F4CB} 已有 Persona:");
  list.forEach((p, i) => console.log(`  ${i + 1}. ${p.name || p.slug} (v${p.version || "?"})`));

  const idx = parseInt(await ask("\n选择编号: ")) - 1;
  const slug = list[idx].slug;

  console.log("\n\u{1F4C2} 选择新聊天记录文件或直接粘贴：");
  const opt = await ask("[A] TXT 文件  [B] JSON 文件  [C] 直接粘贴\n选择 (a/b/c): ");

  let content = "";
  if (["a", "A"].includes(opt)) {
    const path = await ask("TXT 文件路径: ");
    content = readFileSync(path, "utf-8").split("\n").filter(l => l.trim()).slice(-200).join("\n");
  } else if (["b", "B"].includes(opt)) {
    const path = await ask("JSON 文件路径: ");
    const json = JSON.parse(readFileSync(path, "utf-8"));
    const msgs = Array.isArray(json) ? json : (json.messages || []);
    content = msgs.map(m => `${m.senderName || m.sender_name || m.from}: ${m.content || m.text}`).slice(-100).join("\n");
  } else {
    console.log("粘贴新内容，输入 END 结束：");
    let lines = [];
    while (true) {
      const line = await ask("");
      if (line === "END") break;
      lines.push(line);
    }
    content = lines.join("\n");
  }

  if (content) {
    const result = await mergeNewContent(slug, content);
    if (result?.summary) {
      console.log(`\n\u2705 ${result.summary}`);
    }
  }
}

async function cmdList() {
  const list = listExisting();
  if (!list.length) {
    console.log("\n\u{1F4ED} 还没有创建任何 Persona");
    return;
  }

  console.log(`\n\u{1F4CB} 共 ${list.length} 个 Persona:\n`);
  list.forEach(p => {
    const layerPath = join(OUTPUT_DIR, p.slug, "persona.json");
    const hasLayers = existsSync(layerPath);
    console.log(`  ${p.name || p.slug}`);
    console.log(`    Slug: ${p.slug}`);
    console.log(`    版本: ${p.version || "?"}`);
    console.log(`    创建: ${p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "?"}`);
    console.log(`    纠正: ${p.correctionsCount || 0} 次`);
    console.log(`    文件: ${hasLayers ? "\u2705" : "\u274C"}`);
    console.log("");
  });
}

async function cmdImport() {
  // 导入到 App 的 SQLite
  const list = listExisting();
  if (!list.length) { console.log("\u274C 还没有任何 Persona"); return; }

  console.log("\n\u{1F4CB} 选择要导入到 App 的 Persona:");
  list.forEach((p, i) => console.log(`  ${i + 1}. ${p.name || p.slug}`));

  const idx = parseInt(await ask("\n选择编号: ")) - 1;
  const slug = list[idx].slug;

  const stylePath = join(OUTPUT_DIR, slug, "styleSummary.txt");
  if (existsSync(stylePath)) {
    const summary = readFileSync(stylePath, "utf-8");
    console.log(`\n\u{1F4AD} 风格摘要（可直接用在 App 的 Persona.styleSummary 字段）：\n`);
    console.log(summary);
  } else {
    console.log("\u26A0\uFE0F 未找到风格摘要文件");
  }
}

// ===================== Main =====================
async function main() {
  console.log("\n\u{2728} === Create Persona CLI ===");
  console.log("从聊天记录创建 5 层 AI Persona\n");

  const args = process.argv.slice(2);

  if (args.includes("--config")) {
    await setupConfig();
  } else if (args.includes("--correct")) {
    await cmdCorrect();
  } else if (args.includes("--merge")) {
    await cmdMerge();
  } else if (args.includes("--list")) {
    await cmdList();
  } else if (args.includes("--import")) {
    await cmdImport();
  } else {
    // 第一次运行先配置
    const config = loadConfig();
    if (!config.apiKey) {
      await setupConfig();
    }

    // 交互菜单
    while (true) {
      console.log("\n\u{1F4CB} 请选择操作：");
      console.log("  1. 创建新 Persona");
      console.log("  2. 查看已有 Persona");
      console.log("  3. 纠正 Persona 行为");
      console.log("  4. 追加聊天记录");
      console.log("  5. 导出风格摘要到 App");
      console.log("  6. 配置 API");
      console.log("  0. 退出");

      const choice = await ask("\n选择 (0-6): ");

      switch (choice) {
        case "1": await cmdCreate(); break;
        case "2": await cmdList(); break;
        case "3": await cmdCorrect(); break;
        case "4": await cmdMerge(); break;
        case "5": await cmdImport(); break;
        case "6": await setupConfig(); break;
        case "0": console.log("\u{1F44B} 再见！"); rl.close(); return;
        default: console.log("\u274C 无效选择");
      }
    }
  }

  rl.close();
}

main().catch(err => {
  console.error("\u274C 错误:", err.message);
  rl.close();
});
