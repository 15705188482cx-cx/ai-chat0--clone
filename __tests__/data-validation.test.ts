/**
 * 数据验收测试：验证数据工程师生成的 test-data 文件格式兼容性
 *
 * 运行方式（数据工程师交付后）：npm test -- --testPathPattern="data-validation"
 * 当前状态：跳过（等待 test-data/ 目录生成）
 */

import fs from "node:fs";
import path from "node:path";
import { parseChatFile } from "../src/modules/chatParser/parserFactory";

const DATA_DIR = path.join(__dirname, "..", "test-data");
const TXT_FILE = path.join(DATA_DIR, "chat_full.txt");
const JSON_FILE = path.join(DATA_DIR, "chat_full.json");
const SKIP_REASON = "等待数据工程师生成 test-data/ 文件";

function fileExists(p: string): boolean {
  try {
    fs.accessSync(p, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

describe.skip(SKIP_REASON, () => {
  it("TXT 文件存在", () => {
    expect(fileExists(TXT_FILE)).toBe(true);
  });

  it("JSON 文件存在", () => {
    expect(fileExists(JSON_FILE)).toBe(true);
  });

  it("TXT 解析后 >= 200 条有效文本消息", () => {
    if (!fileExists(TXT_FILE)) return;
    const content = fs.readFileSync(TXT_FILE, "utf-8");
    const result = parseChatFile(content, "txt");
    expect(result.totalMessages).toBeGreaterThanOrEqual(200);
  });

  it("JSON 解析后 >= 200 条有效文本消息", () => {
    if (!fileExists(JSON_FILE)) return;
    const content = fs.readFileSync(JSON_FILE, "utf-8");
    const result = parseChatFile(content, "json");
    expect(result.totalMessages).toBeGreaterThanOrEqual(200);
  });

  it("解析出 2 个参与者", () => {
    if (!fileExists(JSON_FILE)) return;
    const content = fs.readFileSync(JSON_FILE, "utf-8");
    const result = parseChatFile(content, "json");
    expect(result.participants.length).toBeGreaterThanOrEqual(2);
  });

  it("至少有 2 个会话段（时间间隔 > 4小时）", () => {
    if (!fileExists(TXT_FILE)) return;
    const content = fs.readFileSync(TXT_FILE, "utf-8");
    const result = parseChatFile(content, "txt");
    expect(result.sessions.length).toBeGreaterThanOrEqual(2);
  });

  it("TXT 和 JSON 消息数一致", () => {
    if (!fileExists(TXT_FILE) || !fileExists(JSON_FILE)) return;
    const txtContent = fs.readFileSync(TXT_FILE, "utf-8");
    const jsonContent = fs.readFileSync(JSON_FILE, "utf-8");
    const txtResult = parseChatFile(txtContent, "txt");
    const jsonResult = parseChatFile(jsonContent, "json");
    // 允许微小差异（TXT 中的系统消息被保留但清洗后过滤，JSON 中的非 text 类型被前置过滤）
    const diff = Math.abs(txtResult.totalMessages - jsonResult.totalMessages);
    expect(diff).toBeLessThanOrEqual(10);
  });
});
