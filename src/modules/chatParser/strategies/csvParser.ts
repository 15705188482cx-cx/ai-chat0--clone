import type { RawMessage } from "../types";

/**
 * CSV 解析策略
 * 支持标准 CSV 和 tab 分隔的 TSV
 * 自动检测列标题：时间/发送者/内容
 */
export function parseCsvFormat(content: string): RawMessage[] {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0) {
    return [];
  }

  // 检测分隔符（逗号或 tab）
  const delimiter = detectDelimiter(lines);
  if (!delimiter) {
    // 无法检测分隔符，尝试按逗号解析
    return parseCsvWithDelimiter(lines, ",");
  }
  return parseCsvWithDelimiter(lines, delimiter);
}

function detectDelimiter(lines: string[]): string | null {
  const sampleLines = lines.slice(0, 5);
  let commaCount = 0;
  let tabCount = 0;

  for (const line of sampleLines) {
    if (!line.trim()) continue;
    const inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === "\"") {
        // Skip quoted content - find matching quote
        let j = i + 1;
        while (j < line.length) {
          if (line[j] === "\"") {
            if (j + 1 < line.length && line[j + 1] === "\"") {
              j += 2;
              continue;
            }
            // End of quote
            i = j;
            break;
          }
          j++;
        }
        continue;
      }
      if (ch === ",") commaCount++;
      if (ch === "\\t") tabCount++;
    }
  }

  if (commaCount > tabCount) return ",";
  if (tabCount > commaCount) return "\\t";
  return null;
}

function parseCsvRow(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === "\"") {
        if (i + 1 < line.length && line[i + 1] === "\"") {
          current += "\"";
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === "\"") {
        inQuotes = true;
      } else if (ch === delimiter) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCsvWithDelimiter(lines: string[], delimiter: string): RawMessage[] {
  // 跳过空行，找到表头
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim()) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) return [];

  const headers = parseCsvRow(lines[headerIndex], delimiter).map((h) => h.toLowerCase().trim());
  const messages: RawMessage[] = [];

  // 找到列映射
  const timeCol = findColumnIndex(headers, ["时间", "日期", "时间戳", "time", "date", "timestamp", "datetime"]);
  const senderCol = findColumnIndex(headers, ["发送者", "发送人", "名字", "名称", "昵称", "sender", "name", "sender_name", "senderName"]);
  const contentCol = findColumnIndex(headers, ["内容", "消息", "信息", "聊天内容", "content", "message", "text", "msg", "消息内容", "聊天记录"]);

  if (senderCol === -1 || contentCol === -1) {
    throw new Error("CSV 缺少必要列：未找到「发送者」和「内容」列。请确保 CSV 包含这些列。");
  }

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCsvRow(line, delimiter);

    const senderName = senderCol < fields.length ? fields[senderCol] : "";
    const content = contentCol < fields.length ? fields[contentCol] : "";
    let timestamp: Date;

    if (timeCol !== -1 && timeCol < fields.length && fields[timeCol]) {
      timestamp = parseTimestamp(fields[timeCol]);
    } else {
      timestamp = new Date();
    }

    if (!senderName && !content) continue;

    messages.push({
      senderName: senderName || "未知",
      content: content || "",
      timestamp,
      type: "text",
    });
  }

  return messages;
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseTimestamp(value: string): Date {
  // 尝试多种时间格式
  const trimmed = value.trim();

  // 格式: 2024-01-15 14:30:45
  const dateTimeMatch = trimmed.match(/^(\d{4}[-/]\d{1,2}[-/]\d{1,2})[\\sT](.+)$/);
  if (dateTimeMatch) {
    const datePart = dateTimeMatch[1].replace(/\\//g, "-");
    const timePart = dateTimeMatch[2].trim();
    const parsed = new Date(datePart + " " + timePart);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  // 格式: 2024-01-15（仅日期）
  const dateOnlyMatch = trimmed.match(/^(\d{4}[-/]\d{1,2}[-/]\d{1,2})$/);
  if (dateOnlyMatch) {
    const parsed = new Date(dateOnlyMatch[1].replace(/\\//g, "-"));
    if (!isNaN(parsed.getTime())) return parsed;
  }

  // 格式: 14:30:45（仅时间，使用今天日期）
  const timeOnlyMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeOnlyMatch) {
    const now = new Date();
    now.setHours(parseInt(timeOnlyMatch[1], 10));
    now.setMinutes(parseInt(timeOnlyMatch[2], 10));
    if (timeOnlyMatch[3]) now.setSeconds(parseInt(timeOnlyMatch[3], 10));
    return now;
  }

  // 格式: 时间戳数字（毫秒）
  const numMatch = trimmed.match(/^(\d{10,13})$/);
  if (numMatch) {
    const ts = parseInt(numMatch[1], 10);
    const parsed = new Date(ts < 1e12 ? ts * 1000 : ts);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  // 通用尝试
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) return parsed;

  // 最后兜底
  return new Date();
}
