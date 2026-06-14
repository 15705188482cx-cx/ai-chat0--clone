// =============================================================================
// screenshotProcessor — 截图导入编排：OCR → DeepSeek 格式化 → 可消费文本
// =============================================================================

import { ocrImage, checkOcrService } from "./paddleOcrBridge";
import { chatNonStreaming } from "../aiEngine/deepseekService";

/** 单张截图处理结果 */
export interface ScreenshotProcessResult {
  /** OCR 原始识别文字 */
  rawText: string;
  /** DeepSeek 格式化后的标准聊天文本 */
  formattedText: string;
  /** OCR 识别的行数 */
  lineCount: number;
  /** 是否可用 */
  valid: boolean;
}

/** DeepSeek 格式化 Prompt */
const FORMAT_PROMPT = `你是一个聊天记录格式化专家。以下是一张微信聊天截图的 OCR 识别结果（可能有不准确之处）。

原始识别文字：
{ocrRawText}

请将这段文字整理为标准聊天记录格式，要求：

1. 每条消息格式为：YYYY-MM-DD HH:mm 发送者: 消息内容
2. 识别每条消息的说话者和时间（如果无法识别时间则省略时间部分）
3. 保留原始表情符号（如 😊 😭 ❤️ ✨ 🥺 🥳）
4. 纠正明显的 OCR 识别错误（如"卤煮"应该是"楼主"、"泥"应该是"你"）
5. 多条消息如果无法区分谁说的，请合理推断，注意说话风格一致性
6. 如果有多条消息粘连在一起，尝试按合理方式拆分
7. 保留原始的时间顺序
8. 输出纯文本，不要 JSON、不要代码块标记、不要额外说明

输出示例：
2024-01-15 14:30 我: 今天吃什么？
2024-01-15 14:31 她: 想吃火锅 😋
2024-01-15 14:32 我: 好啊，去海底捞`;

/**
 * 处理单张截图：OCR → DeepSeek 格式化
 */
export async function processScreenshot(
  imageBase64: string,
): Promise<ScreenshotProcessResult> {
  // Step 1: OCR 识别
  const ocrResult = await ocrImage(imageBase64);

  if (!ocrResult.text.trim()) {
    return {
      rawText: "",
      formattedText: "",
      lineCount: 0,
      valid: false,
    };
  }

  // Step 2: DeepSeek 格式化
  const prompt = FORMAT_PROMPT.replace("{ocrRawText}", ocrResult.text);
  let formattedText = "";

  try {
    formattedText = await chatNonStreaming([
      { role: "user", content: prompt },
    ]);
  } catch (err) {
    // 如果 DeepSeek 格式化失败，降级使用 OCR 原始文字
    console.warn("[screenshotProcessor] DeepSeek 格式化失败，使用 OCR 原始文字:", err);
    formattedText = ocrResult.text;
  }

  return {
    rawText: ocrResult.text,
    formattedText,
    lineCount: ocrResult.lineCount,
    valid: ocrResult.text.trim().length > 0,
  };
}

/**
 * 批量处理多张截图
 */
export async function processScreenshots(
  images: string[],
  options?: {
    onProgress?: (current: number, total: number) => void;
    concurrency?: number;
  },
): Promise<ScreenshotProcessResult[]> {
  const concurrency = options?.concurrency ?? 2;
  const results: ScreenshotProcessResult[] = [];

  for (let i = 0; i < images.length; i += concurrency) {
    const batch = images.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((img) => processScreenshot(img)),
    );
    results.push(...batchResults);
    options?.onProgress?.(Math.min(i + concurrency, images.length), images.length);
  }

  return results;
}

/**
 * 合并多张截图处理结果的格式化文本
 */
export function mergeScreenshotResults(
  results: ScreenshotProcessResult[],
): string {
  return results
    .filter((r) => r.valid)
    .map((r) => r.formattedText)
    .join("\n");
}

/**
 * 检查 OCR 服务可用性
 */
export { checkOcrService } from "./paddleOcrBridge";
