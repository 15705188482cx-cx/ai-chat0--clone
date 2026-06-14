// =============================================================================
// WeChat HTML parser - supports WechatExporter export format
// =============================================================================

import type { RawMessage } from "../types";

/** WechatExporter time format: 2024-01-15 下午 2:30:45 */
const WECHAT_TIME_REGEX = /(\d{4}-\d{2}-\d{2})\s+(上午|下午|凌晨|中午|早上|傍晚|晚上|AM|PM|am|pm)\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/;

/** Media placeholder */
const MEDIA_PLACEHOLDER_REGEX = /^\[(图片|视频|语音|文件|表情|位置|名片|链接|红包|转账|动画表情|小程序|聊天记录|撤回了一条消息|个人名片|Rock-Paper-Scissors|红包封面|引用|笔记|直播|音乐|投票|接龙|文件分享|共享实时位置|视频|语音通话|群公告|拍了拍|个人状态|笔记消息|合并转发|链接分享|未知消息)\]$/;

/** System notices */
const SYSTEM_NOTICE_REGEX = /^(你已添加了|你已经|以上是打招呼|对方已开启|对方正在输入|消息已发出但被对方拒收|开启了朋友验证|发送了一条|发起群聊|修改群名为|邀请你加入|被移出群聊|被管理员|修改群公告|解散了群聊|退出了群聊|已退出群聊|撤回了一条消息)/;

/**
 * Strip HTML tags and decode entities
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Convert Chinese time period to 24-hour format
 */
function parseChineseTime(
  yearMonthDay: string,
  period: string,
  hour: string,
  minute: string,
  second?: string,
): Date {
  let h = parseInt(hour, 10);
  const m = parseInt(minute, 10);
  const s = second ? parseInt(second, 10) : 0;

  const upperPeriod = period.toUpperCase();

  // PM periods: 下午, 晚上, 傍晚, PM
  if (
    upperPeriod.includes("下") ||
    upperPeriod === "PM" ||
    upperPeriod.includes("晚") ||
    upperPeriod.includes("傍")
  ) {
    if (h !== 12) h += 12;
  }
  // AM periods: 凌晨, 早上, 上午, AM
  // Special: 中午 (noon) - keep h=12, do NOT set to 0
  else if (
    (upperPeriod.includes("凌") ||
     upperPeriod.includes("早") ||
     upperPeriod.includes("上") ||
     upperPeriod === "AM") &&
    h === 12
  ) {
    h = 0;
  }
  // 中午: h stays at 12

  const dateStr =
    yearMonthDay +
    " " +
    String(h).padStart(2, "0") +
    ":" +
    String(m).padStart(2, "0") +
    ":" +
    String(s).padStart(2, "0");
  return new Date(dateStr);
}

/**
 * Parse AM/PM time format where period follows digits: "2024-01-15 2:30:45 PM"
 */
function parseAmPmTime(str: string): Date | null {
  const match = str.match(
    /(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)/,
  );
  if (!match) return null;

  let h = parseInt(match[2], 10);
  const m = parseInt(match[3], 10);
  const s = match[4] ? parseInt(match[4], 10) : 0;
  const period = match[5].toUpperCase();

  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;

  const dateStr =
    match[1] +
    " " +
    String(h).padStart(2, "0") +
    ":" +
    String(m).padStart(2, "0") +
    ":" +
    String(s).padStart(2, "0");
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Build a RawMessage from parsed components, filtering media/system
 */
function tryBuildMessage(
  sender: string,
  content: string,
  timestamp: Date | null,
): RawMessage | null {
  if (!sender || !content || !timestamp) return null;
  if (MEDIA_PLACEHOLDER_REGEX.test(content)) return null;
  if (SYSTEM_NOTICE_REGEX.test(content)) return null;
  return {
    senderName: sender,
    content,
    timestamp,
    type: "text",
  };
}

/**
 * Parse WechatExporter HTML
 *
 * Three strategies, tried in order:
 * 1. Structured text lines: "时间 发送人: 内容"
 * 2. Div-based block parsing (for WechatExporter message divs)
 * 3. Sequential div chase (sender → content → time chains)
 */
function parseWechatExporterHTML(html: string): RawMessage[] {
  // ==========================================================================
  // Strategy 1: Structured text lines
  // Supports both "YYYY-MM-DD 上午 H:MM:SS" and "YYYY-MM-DD H:MM:SS PM"
  // ==========================================================================
  const lineRegex1 =
    /(\d{4}-\d{2}-\d{2}\s+(?:上午|下午|凌晨|中午|早上|傍晚|晚上)\s*\d{1,2}:\d{2}(?::\d{2})?)\s+(.+?)[:：]\s*(.+)/g;
  const lineRegex2 =
    /(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm))\s+(.+?)[:：]\s*(.+)/g;

  const lineResults: RawMessage[] = [];

  // Try pattern 1: Chinese period (上午/下午) before time
  let match: RegExpExecArray | null;
  while ((match = lineRegex1.exec(html)) !== null) {
    const timeStr = match[1];
    const sender = match[2].trim();
    const content = match[3].trim();

    const timeMatch = timeStr.match(WECHAT_TIME_REGEX);
    if (!timeMatch) continue;

    const timestamp = parseChineseTime(
      timeMatch[1],
      timeMatch[2],
      timeMatch[3],
      timeMatch[4],
      timeMatch[5],
    );
    if (isNaN(timestamp.getTime())) continue;

    const msg = tryBuildMessage(sender, content, timestamp);
    if (msg) lineResults.push(msg);
  }

  // Try pattern 2: AM/PM after time digits
  while ((match = lineRegex2.exec(html)) !== null) {
    const timeStr = match[1];
    const sender = match[2].trim();
    const content = match[3].trim();

    const timestamp = parseAmPmTime(timeStr);
    if (!timestamp) continue;

    const msg = tryBuildMessage(sender, content, timestamp);
    if (msg) lineResults.push(msg);
  }

  if (lineResults.length > 0) return lineResults;

  // ==========================================================================
  // Strategy 2: Extract all leaf divs (non-nested content + metadata)
  // We use a two-pass approach:
  // Pass 1: extract non-nested <div>s (those without <div> inside)
  // Pass 2: chain sender → content → time groups
  // ==========================================================================

  // Extract only leaf divs (no nested divs inside)
  const leafDivRegex = /<div[^>]*>([^<]*)<\/div>/gi;
  const leafDivs: Array<{ tag: string; text: string }> = [];
  let leafMatch: RegExpExecArray | null;
  while ((leafMatch = leafDivRegex.exec(html)) !== null) {
    leafDivs.push({
      tag: leafMatch[0],
      text: leafMatch[1].trim(),
    });
  }

  // If leaf divs didn't yield enough, fall back to all divs
  const divs =
    leafDivs.length >= 3
      ? leafDivs
      : (() => {
          const divRegex = /<div[^>]*>(.*?)<\/div>/gi;
          const all: Array<{ tag: string; text: string }> = [];
          let m: RegExpExecArray | null;
          while ((m = divRegex.exec(html)) !== null) {
            all.push({ tag: m[0], text: stripHtmlTags(m[1]) });
          }
          return all;
        })();

  const messages: RawMessage[] = [];
  let currentSender = "";
  let currentTime: Date | null = null;
  let currentLines: string[] = [];

  function flushMessage() {
    if (currentSender && currentLines.length > 0 && currentTime) {
      const content = currentLines.join("\n").trim();
      const msg = tryBuildMessage(currentSender, content, currentTime);
      if (msg) messages.push(msg);
    }
    currentLines = [];
    currentTime = null;
  }

  for (const div of divs) {
    const tagLower = div.tag.toLowerCase();

    // Sender div
    if (
      tagLower.includes('class="sender"') ||
      tagLower.includes('class="nickname"') ||
      tagLower.includes('class="name"')
    ) {
      flushMessage();
      currentSender = div.text;
      continue;
    }

    // Time div
    if (
      tagLower.includes('class="time"') ||
      tagLower.includes('class="timestamp"')
    ) {
      // Try Chinese time format
      const timeMatch = div.text.match(WECHAT_TIME_REGEX);
      if (timeMatch) {
        currentTime = parseChineseTime(
          timeMatch[1],
          timeMatch[2],
          timeMatch[3],
          timeMatch[4],
          timeMatch[5],
        );
      } else {
        // Try AM/PM after format
        const amPmTime = parseAmPmTime(div.text);
        if (amPmTime) currentTime = amPmTime;
      }
      continue;
    }

    // Content div (only match specific content classes, NOT wrapper classes)
    if (
      tagLower.includes('class="content"') ||
      tagLower.includes('class="message-text"') ||
      tagLower.includes('class="text"')
    ) {
      if (div.text.trim()) {
        currentLines.push(div.text.trim());
      }
      continue;
    }

    // Wrapper divs (message, msg-item, chat-item) act as message boundaries
    if (
      tagLower.includes('class="message"') ||
      tagLower.includes('class="msg-item"') ||
      tagLower.includes('class="chat-item"')
    ) {
      flushMessage();
      // Reset sender too, as this is a new message boundary
      // (sender will be set by the next sender div)
      continue;
    }
  }

  // Flush last message
  flushMessage();

  if (messages.length > 0) return messages;

  // ==========================================================================
  // Strategy 3: Full HTML strip + line regex on plain text
  // ==========================================================================
  const plainText = stripHtmlTags(html);
  const plainRegex =
    /(\d{4}-\d{2}-\d{2}\s+(?:上午|下午|凌晨|中午|早上|傍晚|晚上|AM|PM|am|pm)\s*\d{1,2}:\d{2}(?::\d{2})?)\s+(.+?)[:：]\s*(.+)/g;

  let plainMatch: RegExpExecArray | null;
  while ((plainMatch = plainRegex.exec(plainText)) !== null) {
    const timeStr = plainMatch[1];
    const sender = plainMatch[2].trim();
    const content = plainMatch[3].trim();

    const timeMatch = timeStr.match(WECHAT_TIME_REGEX);
    if (!timeMatch) continue;

    const timestamp = parseChineseTime(
      timeMatch[1],
      timeMatch[2],
      timeMatch[3],
      timeMatch[4],
      timeMatch[5],
    );
    if (isNaN(timestamp.getTime())) continue;

    const msg = tryBuildMessage(sender, content, timestamp);
    if (msg) messages.push(msg);
  }

  return messages;
}

/**
 * Parse WeChat HTML chat export
 */
export function parseHtmlFormat(content: string): RawMessage[] {
  return parseWechatExporterHTML(content);
}
