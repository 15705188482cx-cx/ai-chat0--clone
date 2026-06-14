// =============================================================================
// paddleOcrBridge — PaddleOCR 侧边服务 HTTP 客户端
// =============================================================================

/** 默认 OCR 服务地址 */
const DEFAULT_OCR_ENDPOINT = "http://127.0.0.1:28666/ocr";

/** OCR 请求超时（毫秒） */
const OCR_TIMEOUT_MS = 30000;

export interface OcrResult {
  text: string;
  lineCount: number;
}

/**
 * 调用本地 PaddleOCR 服务识别图片文字
 * @param imageBase64 base64 编码的图片数据
 * @param options 可选参数（端点地址、超时时间）
 * @returns OCR 识别结果
 * @throws 如果服务不可用或识别失败
 */
export async function ocrImage(
  imageBase64: string,
  options?: {
    endpoint?: string;
    timeout?: number;
  },
): Promise<OcrResult> {
  const endpoint = options?.endpoint ?? DEFAULT_OCR_ENDPOINT;
  const timeout = options?.timeout ?? OCR_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageBase64 }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        "OCR 服务错误 (" + response.status + "): " + (errorBody || response.statusText),
      );
    }

    const data = await response.json();
    if (data.error) {
      throw new Error("OCR 识别失败: " + data.error);
    }

    return {
      text: data.text || "",
      lineCount: data.line_count || 0,
    };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("OCR 请求超时，请确认 PaddleOCR 服务已启动（ocr-server/ 目录下运行 python app.py）");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 检查 OCR 服务是否可用
 */
export async function checkOcrService(
  endpoint?: string,
): Promise<boolean> {
  try {
    const url = (endpoint ?? DEFAULT_OCR_ENDPOINT).replace("/ocr", "/");
    const response = await fetch(url, { method: "GET", signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
}
