import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");

/**
 * 生成并保存 Persona 文件
 */
export function buildPersonaFiles(personaData, memoriesData, meta) {
  const { slug, name } = meta;
  const dir = join(OUTPUT_DIR, slug);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // 1. 写 persona.json
  const persona = {
    name,
    slug,
    layers: {
      layer0: personaData.layer0 || personaData["Layer 0"] || [],
      layer1: personaData.layer1 || personaData["Layer 1"] || {},
      layer2: personaData.layer2 || personaData["Layer 2"] || {},
      layer3: personaData.layer3 || personaData["Layer 3"] || {},
      layer4: personaData.layer4 || personaData["Layer 4"] || {},
      layer5: personaData.layer5 || personaData["Layer 5"] || [],
    },
    corrections: [],
  };
  writeFileSync(join(dir, "persona.json"), JSON.stringify(persona, null, 2), "utf-8");

  // 2. 写 persona.md（可读版本）
  const md = buildPersonaMarkdown(name, persona);
  writeFileSync(join(dir, "persona.md"), md, "utf-8");

  // 3. 写 memories.json
  const memories = {
    name,
    slug,
    timeline: memoriesData.relationshipTimeline || memoriesData["关系时间线"] || [],
    dailyRituals: memoriesData.dailyRituals || memoriesData["共同日常与仪式"] || {},
    preferences: memoriesData.preferences || memoriesData["她的偏好"] || {},
    conflictPattern: memoriesData.conflictPattern || memoriesData["冲突与修复模式"] || {},
    emotionalDynamics: memoriesData.emotionalDynamics || memoriesData["情感动态"] || {},
  };
  writeFileSync(join(dir, "memories.json"), JSON.stringify(memories, null, 2), "utf-8");

  // 4. 写 memories.md（可读版本）
  const memoriesMd = buildMemoriesMarkdown(name, memories);
  writeFileSync(join(dir, "memories.md"), memoriesMd, "utf-8");

  // 5. 写 meta.json
  const metaFile = {
    ...meta,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: "v1",
    correctionsCount: 0,
  };
  writeFileSync(join(dir, "meta.json"), JSON.stringify(metaFile, null, 2), "utf-8");

  // 6. 写 styleSummary.txt（兼容 app 直接用）
  if (personaData.styleSummary || personaData.raw) {
    const styleText = personaData.styleSummary || personaData.raw;
    writeFileSync(join(dir, "styleSummary.txt"), styleText, "utf-8");
  }

  console.log(`\n\u2705 文件已生成到: ${dir}`);
  return dir;
}

function buildPersonaMarkdown(name, persona) {
  const l = persona.layers;
  let md = `# ${name} — Persona\n\n---\n\n`;

  // Layer 0
  md += `## Layer 0：核心性格（最高优先级，任何情况下不得违背）\n\n`;
  if (l.layer0?.length) {
    l.layer0.forEach(r => md += `- ${r}\n`);
  } else {
    md += `（原材料不足）\n`;
  }
  md += `\n---\n\n`;

  // Layer 1
  md += `## Layer 1：身份\n\n你是 ${name}。\n`;
  if (l.layer1) {
    if (l.layer1.职业推断) md += `你做 ${l.layer1.职业推断}。\n`;
    if (l.layer1.MBTI推断) md += `MBTI ${l.layer1.MBTI推断}。\n`;
    if (l.layer1.依恋类型推断) md += `你的依恋类型是 ${l.layer1.依恋类型推断}。\n`;
  }
  md += `\n---\n\n`;

  // Layer 2
  md += `## Layer 2：表达风格\n\n`;
  if (l.layer2) {
    const l2 = l.layer2;
    if (l2.口头禅列表?.length) md += `### 口头禅\n${l2.口头禅列表.map(p => `- 「${p}」`).join("\n")}\n\n`;
    if (l2.高频词列表?.length) md += `### 高频词\n${l2.高频词列表.map(w => `- ${w}`).join("\n")}\n\n`;
    if (l2.句式特征描述) md += `### 句式\n${l2.句式特征描述}\n\n`;
    if (l2.emoji使用描述) md += `### Emoji\n${l2.emoji使用描述}\n\n`;
  } else {
    md += `（原材料不足）\n\n`;
  }
  md += `---\n\n`;

  // Layer 3
  md += `## Layer 3：情感逻辑\n\n`;
  if (l.layer3) {
    const l3 = l.layer3;
    if (l3.情感优先级) md += `**情感优先级**：${Array.isArray(l3.情感优先级) ? l3.情感优先级.join(" > ") : l3.情感优先级}\n\n`;
    if (l3.表达爱意触发条件) md += `**会主动表达爱的时候**：${l3.表达爱意触发条件}\n\n`;
    if (l3.退缩触发条件) md += `**会退缩或沉默的时候**：${l3.退缩触发条件}\n\n`;
    if (l3["表达不满的方式及示例话术"]) md += `**表达不满的方式**：${l3["表达不满的方式及示例话术"]}\n\n`;
  } else {
    md += `（原材料不足）\n\n`;
  }
  md += `---\n\n`;

  // Layer 4
  md += `## Layer 4：关系行为\n\n`;
  if (l.layer4 && typeof l.layer4 === "object") {
    for (const [key, val] of Object.entries(l.layer4)) {
      md += `### ${key}\n${val}\n\n`;
    }
  } else {
    md += `（原材料不足）\n\n`;
  }
  md += `---\n\n`;

  // Layer 5
  md += `## Layer 5：边界与雷区\n\n`;
  if (l.layer5?.length) {
    l.layer5.forEach(r => md += `- ${r}\n`);
  } else {
    md += `（原材料不足）\n\n`;
  }
  md += `\n---\n\n`;

  // Correction
  md += `## Correction 记录\n\n（暂无记录）\n`;

  return md;
}

function buildMemoriesMarkdown(name, memories) {
  let md = `# ${name} — 共同记忆\n\n---\n\n`;

  // 关系时间线
  md += `## 重要时刻\n\n`;
  if (memories.timeline?.length) {
    memories.timeline.forEach(t => md += `- ${t}\n`);
  } else {
    md += `（原材料不足）\n`;
  }
  md += `\n---\n\n`;

  // 日常与仪式
  md += `## 日常与仪式\n\n`;
  if (memories.dailyRituals && typeof memories.dailyRituals === "object") {
    for (const [key, val] of Object.entries(memories.dailyRituals)) {
      md += `### ${key}\n${Array.isArray(val) ? val.map(v => `- ${v}`).join("\n") : val}\n\n`;
    }
  }
  md += `---\n\n`;

  // 她的偏好
  md += `## 她的偏好\n\n`;
  if (memories.preferences && typeof memories.preferences === "object") {
    for (const [key, val] of Object.entries(memories.preferences)) {
      md += `### ${key}\n${Array.isArray(val) ? val.map(v => `- ${v}`).join("\n") : val}\n\n`;
    }
  }
  md += `---\n\n`;

  // 情感模式
  md += `## 情感模式\n\n`;
  if (memories.emotionalDynamics && typeof memories.emotionalDynamics === "object") {
    for (const [key, val] of Object.entries(memories.emotionalDynamics)) {
      md += `### ${key}\n${val}\n\n`;
    }
  }

  return md;
}
