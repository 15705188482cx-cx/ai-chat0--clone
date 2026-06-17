import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import {
  processScreenshot,
  processScreenshots,
  checkOcrService,
} from "../modules/ocr";
import type { ScreenshotProcessResult } from "../modules/ocr";
import { parseChatFile } from "../modules/chatParser";
import { getStore } from "../modules/database/storeProvider";
import { nanoid } from "nanoid";

const WECHAT_GREEN = "#07C160";
const PAGE_BG = "#F3F3F3";

type WizardStep =
  | "select"    // 选择截图
  | "ocr"       // OCR 识别中
  | "review"    // 预览原始文字
  | "format"    // DeepSeek 格式化中
  | "result";   // 格式化结果

interface SelectedImage {
  uri: string;
  base64: string;
  fileName: string;
}

/**
 * 将图片 URI 转为 base64（Web 端用 fetch，移动端用 FileSystem）
 */
async function uriToBase64(uri: string): Promise<string> {
  if (typeof window !== "undefined") {
    // Web: fetch image and convert to base64
    const resp = await fetch(uri);
    const blob = await resp.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // 去掉 data:image/...;base64, 前缀
        const base64 = result.split(",")[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  // 移动端使用 expo-file-system
  const FileSystem = await import("expo-file-system");
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64;
}

export default function ScreenshotImportScreen() {
  const router = useRouter();

  const [step, setStep] = useState<WizardStep>("select");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [processResults, setProcessResults] = useState<ScreenshotProcessResult[]>([]);
  const [currentProcessing, setCurrentProcessing] = useState(0);
  const [totalProcessing, setTotalProcessing] = useState(0);
  const [editRawText, setEditRawText] = useState("");
  const [editingIndex, setEditingIndex] = useState(0);
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 检查 OCR 服务
  const checkService = useCallback(async () => {
    const ok = await checkOcrService();
    setServiceAvailable(ok);
    if (!ok) {
      setError("截图OCR功能需要在电脑上运行 OCR 服务（详见 README）。当前可用方案:文件导入或加载测试数据");
    }
  }, []);

  // 选择截图
  const handlePickImages = useCallback(async () => {
    setError(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("权限不足", "需要相册权限才能选择截图");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      if (result.canceled || !result.assets.length) return;

      const images: SelectedImage[] = [];
      for (const asset of result.assets) {
        if (asset.uri) {
          images.push({
            uri: asset.uri,
            base64: "",
            fileName: asset.fileName || "screenshot.png",
          });
        }
      }
      setSelectedImages(images);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "选择截图失败";
      setError(msg);
    }
  }, []);

  // 开始 OCR 识别
  const handleStartOcr = useCallback(async () => {
    if (selectedImages.length === 0) return;
    setError(null);
    setServiceAvailable(null);

    // 检查服务
    const ok = await checkOcrService();
    if (!ok) {
      setError("截图OCR功能需要在电脑上运行 OCR 服务（详见 README）。当前可用方案:文件导入或加载测试数据");
      return;
    }

    setStep("ocr");
    setTotalProcessing(selectedImages.length);

    try {
      // 先将所有图片转为 base64
      const base64Images: string[] = [];
      for (let i = 0; i < selectedImages.length; i++) {
        setCurrentProcessing(i + 1);
        const b64 = await uriToBase64(selectedImages[i].uri);
        base64Images.push(b64);
      }

      // 批量 OCR + DeepSeek
      setCurrentProcessing(0);
      const results = await processScreenshots(base64Images, {
        onProgress: (current, total) => {
          setCurrentProcessing(current);
        },
        concurrency: 2,
      });

      setProcessResults(results);

      // 显示第一个结果的原始文字
      if (results.length > 0) {
        setEditingIndex(0);
        setEditRawText(results[0].rawText);
      }

      setStep("review");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "OCR 识别失败";
      setError(msg);
      setStep("select");
    }
  }, [selectedImages, checkOcrService]);

  // 提交 DeepSeek 格式化
  const handleFormat = useCallback(async () => {
    setError(null);
    setStep("format");

    try {
      // 使用编辑后的文字更新 processResults
      const updated = [...processResults];
      updated[editingIndex] = {
        ...updated[editingIndex],
        rawText: editRawText,
      };

      // 重新处理当前编辑的截图
      const result = await processScreenshot("");
      // 用编辑后的文字直接格式化
      const { chatNonStreaming } = await import("../modules/aiEngine/deepseekService");
      const FORMAT_PROMPT = `你是一个聊天记录格式化专家。以下是一张微信聊天截图的 OCR 识别结果（可能有不准确之处）。

原始识别文字：
${editRawText}

请将这段文字整理为标准聊天记录格式，要求：

1. 每条消息格式为：YYYY-MM-DD HH:mm 发送者: 消息内容
2. 识别每条消息的说话者和时间
3. 保留原始表情符号
4. 输出纯文本，不要 JSON、不要代码块标记`;

      const formatted = await chatNonStreaming([
        { role: "user", content: FORMAT_PROMPT },
      ]);

      updated[editingIndex] = {
        ...updated[editingIndex],
        rawText: editRawText,
        formattedText: formatted,
        valid: true,
      };

      setProcessResults(updated);
      setStep("result");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "格式化失败";
      setError(msg);
      setStep("review");
    }
  }, [processResults, editingIndex, editRawText]);

  // 导出为 TXT 文件
  const handleExportTxt = useCallback(async () => {
    try {
      const fullText = processResults
        .filter((r) => r.valid)
        .map((r) => r.formattedText)
        .join("\n");

      if (!fullText.trim()) {
        Alert.alert("提示", "没有可导出的内容");
        return;
      }

      if (typeof window !== "undefined") {
        // Web: 使用 Blob 下载
        const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "chat_screenshot_export.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Alert.alert("导出成功", "文件已下载，可在导入页选择该文件");
      } else {
        Alert.alert("导出", "移动端导出暂不支持，请使用直接导入");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "导出失败";
      Alert.alert("错误", msg);
    }
  }, [processResults]);

  // 直接进入解析管道
  const handleDirectImport = useCallback(async () => {
    try {
      const fullText = processResults
        .filter((r) => r.valid)
        .map((r) => r.formattedText)
        .join("\n");

      if (!fullText.trim()) {
        Alert.alert("提示", "没有可导入的聊天内容");
        return;
      }

      // 直接用 TXT 格式解析
      const parseResult = parseChatFile(fullText, "txt");

      if (parseResult.totalMessages === 0) {
        Alert.alert("解析失败", "未解析到有效聊天消息");
        return;
      }

      // 保存到数据库
      const store = await getStore();
      const batchId = nanoid();
      const records = parseResult.sessions
        .flatMap((s) => s.messages)
        .filter((m) => m.type === "text" && m.content.trim())
        .map((m) => ({
          batch_id: batchId,
          sender_name: m.senderName,
          content: m.content,
          timestamp: m.timestamp.toISOString(),
          session_id: null,
          type: m.type,
        }));

      await store.bulkInsertChatRecords(records);

      Alert.alert(
        "导入成功",
        `成功导入 ${parseResult.totalMessages} 条消息\n参与者：${parseResult.participants.join("、")}`,
        [
          {
            text: "创建分身",
            onPress: () => {
              const target = parseResult.participants.find((p) => p !== "我") || parseResult.participants[0];
              router.push({
                pathname: "/persona/setup",
                params: { preSelectedSender: target },
              });
            },
          },
          { text: "返回首页", onPress: () => router.replace("/") },
        ],
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "导入失败";
      Alert.alert("错误", msg);
    }
  }, [processResults, router]);

  return (
    <SafeAreaView style={styles.container}>
      {/* 导航栏 */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.back()}>
          <Text style={styles.navBack}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>截图导入</Text>
        <View style={styles.navBtn} />
      </View>

      <View style={styles.content}>
        {/* Step 1: 选择截图 */}
        {step === "select" && (
          <View style={styles.centerContent}>
            <Text style={styles.emoji}>📸</Text>
            <Text style={styles.title}>选择聊天截图</Text>
            <Text style={styles.subtitle}>
              选择包含聊天记录的截图{"\n"}
              支持多选，建议每张包含 5-20 条消息
            </Text>

            {selectedImages.length > 0 && (
              <View style={styles.selectedPreview}>
                <Text style={styles.selectedCount}>
                  已选 {selectedImages.length} 张截图
                </Text>
                <ScrollView horizontal style={styles.thumbScroll}>
                  {selectedImages.map((img, i) => (
                    <Image
                      key={i}
                      source={{ uri: img.uri }}
                      style={styles.thumbImg}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handlePickImages}
              activeOpacity={0.7}
            >
              <Text style={styles.primaryBtnText}>
                {selectedImages.length > 0 ? "重新选择" : "从相册选择"}
              </Text>
            </TouchableOpacity>

            {selectedImages.length > 0 && (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: WECHAT_GREEN, marginTop: 12 }]}
                onPress={handleStartOcr}
                activeOpacity={0.7}
              >
                <Text style={styles.primaryBtnText}>
                  🚀 开始识别 ({selectedImages.length} 张)
                </Text>
              </TouchableOpacity>
            )}

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>
        )}

        {/* Step 2: OCR 识别中 */}
        {step === "ocr" && (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={WECHAT_GREEN} />
            <Text style={styles.parsingTitle}>正在识别截图文字...</Text>
            <Text style={styles.parsingHint}>
              第 {currentProcessing}/{totalProcessing} 张
            </Text>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${(currentProcessing / totalProcessing) * 100}%` },
                ]}
              />
            </View>
          </View>
        )}

        {/* Step 3: 预览原始文字 */}
        {step === "review" && (
          <View style={styles.flexContent}>
            <Text style={styles.sectionTitle}>
              截图 {editingIndex + 1}/{processResults.length} 原始识别文字
            </Text>
            <Text style={styles.sectionHint}>
              可手动修正错别字后点「AI 格式化」
            </Text>
            <TextInput
              style={styles.rawTextInput}
              value={editRawText}
              onChangeText={setEditRawText}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.btnRow}>
              {editingIndex > 0 && (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => {
                    setEditingIndex(editingIndex - 1);
                    setEditRawText(processResults[editingIndex - 1].rawText);
                  }}
                >
                  <Text style={styles.secondaryBtnText}>上一张</Text>
                </TouchableOpacity>
              )}
              {editingIndex < processResults.length - 1 && (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => {
                    setEditingIndex(editingIndex + 1);
                    setEditRawText(processResults[editingIndex + 1].rawText);
                  }}
                >
                  <Text style={styles.secondaryBtnText}>下一张</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1 }]}
                onPress={handleFormat}
              >
                <Text style={styles.primaryBtnText}>🤖 AI 格式化</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 4: 格式化中 */}
        {step === "format" && (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={WECHAT_GREEN} />
            <Text style={styles.parsingTitle}>AI 正在格式化聊天记录...</Text>
            <Text style={styles.parsingHint}>正在转换为标准聊天格式</Text>
          </View>
        )}

        {/* Step 5: 结果 */}
        {step === "result" && (
          <ScrollView style={styles.resultScroll} contentContainerStyle={styles.resultContent}>
            <Text style={styles.resultIcon}>{"\u2713"}</Text>
            <Text style={styles.resultTitle}>格式化完成</Text>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>共处理截图</Text>
              <Text style={styles.summaryValue}>
                {processResults.filter((r) => r.valid).length} / {processResults.length} 张
              </Text>
            </View>

            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>格式化结果预览</Text>
              <ScrollView style={styles.previewScroll}>
                <Text style={styles.previewText}>
                  {processResults
                    .filter((r) => r.valid)
                    .map((r) => r.formattedText)
                    .join("\n")
                    .slice(0, 1000)}
                </Text>
              </ScrollView>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: WECHAT_GREEN }]}
              onPress={handleDirectImport}
              activeOpacity={0.7}
            >
              <Text style={styles.primaryBtnText}>📥 直接创建分身</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: "#4A90D9", marginTop: 12 }]}
              onPress={handleExportTxt}
              activeOpacity={0.7}
            >
              <Text style={styles.primaryBtnText}>💾 导出为 TXT（再走文件导入）</Text>
            </TouchableOpacity>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  content: { flex: 1 },
  flexContent: { flex: 1, padding: 16 },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5E5",
    backgroundColor: "#FFF",
  },
  navBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  navBack: { color: "#000", fontSize: 22, fontWeight: "400" },
  navTitle: { flex: 1, color: "#000", fontSize: 17, fontWeight: "600", textAlign: "center" },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#191919", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#999", textAlign: "center", marginBottom: 24, lineHeight: 20 },
  primaryBtn: {
    backgroundColor: "#4A90D9",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    minWidth: 200,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  selectedPreview: { width: "100%", marginBottom: 16 },
  selectedCount: { fontSize: 14, color: "#666", marginBottom: 8 },
  thumbScroll: { flexDirection: "row" },
  thumbImg: { width: 80, height: 120, borderRadius: 8, marginRight: 8, backgroundColor: "#DDD" },
  parsingTitle: { fontSize: 18, fontWeight: "600", color: "#333", marginTop: 24 },
  parsingHint: { fontSize: 14, color: "#999", marginTop: 8 },
  progressBarBg: {
    width: "80%",
    height: 6,
    backgroundColor: "#E0E0E0",
    borderRadius: 3,
    marginTop: 16,
    overflow: "hidden",
  },
  progressBarFill: { height: 6, backgroundColor: WECHAT_GREEN, borderRadius: 3 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#191919", marginBottom: 4 },
  sectionHint: { fontSize: 13, color: "#999", marginBottom: 12 },
  rawTextInput: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    color: "#333",
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  btnRow: { flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 20 },
  secondaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#DDD",
    alignItems: "center",
  },
  secondaryBtnText: { fontSize: 14, color: "#666", fontWeight: "500" },
  resultScroll: { flex: 1 },
  resultContent: { alignItems: "center", paddingHorizontal: 24, paddingBottom: 40 },
  resultIcon: { fontSize: 48, marginTop: 20 },
  resultTitle: { fontSize: 22, fontWeight: "700", color: "#191919", marginTop: 8, marginBottom: 20 },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    marginBottom: 16,
  },
  summaryLabel: { fontSize: 14, color: "#666" },
  summaryValue: { fontSize: 14, fontWeight: "600", color: "#333", marginTop: 4 },
  previewCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    width: "100%",
    marginBottom: 16,
    maxHeight: 300,
  },
  previewLabel: { fontSize: 14, fontWeight: "600", color: "#191919", marginBottom: 8 },
  previewScroll: { maxHeight: 240 },
  previewText: { fontSize: 13, color: "#333", lineHeight: 18, fontFamily: "monospace" },
  errorBox: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#FFF0F0",
    borderRadius: 8,
    alignItems: "center",
    width: "100%",
  },
  errorText: { color: "#E74C3C", fontSize: 14, marginBottom: 8, textAlign: "center" },
});
