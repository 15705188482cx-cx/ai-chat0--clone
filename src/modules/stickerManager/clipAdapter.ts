import Constants from "expo-constants";

const USE_CLIP = Constants.expoConfig?.extra?.enableCLIPOnDevice ?? false;

/**
 * 向量编码适配层 —— 当前返回 null 走关键词降级方案。
 * 后续启用 ONNX 后，在此函数中加载 CLIP 文本编码器。
 */
export async function encodeText(_text: string): Promise<Float32Array | null> {
  if (!USE_CLIP) return null;
  // TODO: 加载 ONNX 模型并推理
  return null;
}
