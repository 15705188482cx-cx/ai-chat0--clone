import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFileImport } from "../modules/fileImport";
import type { FileImportResult } from "../modules/fileImport";
import { parseChatFile } from "../modules/chatParser";
import type { ParseResult } from "../modules/chatParser/types";


import {
  findPersonaBySender,
  addSamplesToPersona,
} from "../modules/persona/personaService";
import type { Persona } from "../modules/persona/types";
import { nanoid } from "nanoid";
import { formatDate } from "../utils/dateFormat";
import { isWeb, addRecordsToMemory } from "../modules/database/memoryFallback";import { getStore } from "../modules/database/storeProvider";

const WECHAT_GREEN = "#07C160";
const PAGE_BG = "#F3F3F3";

type WizardStep = "select" | "parsing" | "result";

interface ParticipantMatch {
  senderName: string;
  persona: Persona | null; // null = 未匹配到已有分身
}

export default function ImportWizardScreen() {
  const router = useRouter();
  const { preSelectedPersonaId } = useLocalSearchParams<{
    preSelectedPersonaId?: string;
  }>();
  const { pickAndRead, isImporting, error: importError } = useFileImport();

  const [step, setStep] = useState<WizardStep>("select");
  const [fileInfo, setFileInfo] = useState<FileImportResult | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [imageCount, setImageCount] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);

  // 参与者匹配结果
  const [participantMatches, setParticipantMatches] = useState<ParticipantMatch[]>([]);

  const handleParse = useCallback(async (file: FileImportResult) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const result = parseChatFile(file.content, file.fileType);

      const allMessages = result.sessions.flatMap((session) => session.messages);
      const imageMessages = allMessages.filter((message) => message.type === "image");
      const textMessages = allMessages.filter((message) => message.type === "text" && message.content.trim());

      if (textMessages.length === 0) {
        throw new Error("未解析到有效文本消息，请检查聊天记录格式");
      }

      if (isWeb()) {
        addRecordsToMemory(
          textMessages.map((message) => ({
            id: nanoid(),
            sender: message.senderName,
            content: message.content,
            timestamp: message.timestamp,
            type: message.type,
          })),
        );
      } else {
        const batchId = nanoid();
        const store = await getStore()
        for (const session of result.sessions) {
          await store.bulkInsertChatRecords(session.messages.map((m: any) => ({ batch_id: batchId, sender_name: m.senderName, content: m.content, timestamp: m.timestamp.toISOString(), session_id: null, type: m.type })));
        }
      }

      const matches: ParticipantMatch[] = [];
      for (const participant of result.participants) {
        if (participant === "我") continue;
        const persona = await findPersonaBySender(participant).catch(() => null);
        matches.push({ senderName: participant, persona });
      }

      setImageCount(imageMessages.length);
      setParseResult(result);
      setParticipantMatches(matches);
      setStep("result");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "解析失败";
      setParseError(message);
      setStep("select");
    }
  }, []);
  const handleSelectFile = useCallback(async () => {
    setParseError(null);
    const result = await pickAndRead();
    if (result) {
      setFileInfo(result);
      setStep("parsing");
      await handleParse(result);
    }
  }, [pickAndRead, handleParse]);

  // 按钮暂时仅作提示（测试数据可从 test-data/ 目录手动选择 JSON 文件）
  const handleLoadTestData = useCallback(async () => {
    try {
      // Web: fetch test data directly from the bundled JSON
      if (isWeb() && typeof window !== "undefined") {
        var raw = null;
        try {
          var resp = await fetch("/test-data.json");
          if (resp.ok) raw = await resp.json();
        } catch (err) { console.warn("[import] 加载测试数据失败:", err); }
        if (!raw) {
          try {
            var resp = await fetch("http://localhost:3456/chat_full.json");
            if (resp.ok) raw = await resp.json();
          } catch (err) { console.warn("[import] 加载测试数据失败:", err); }
        }
        if (!raw && typeof window !== "undefined" && (window as any).__TEST_DATA__) {
          raw = (window as any).__TEST_DATA__;
        }
        if (!raw) throw new Error("无法加载测试数据，请手动选择文件导入");
        const result = parseChatFile(JSON.stringify(raw), "json");
        if (!result || result.totalMessages === 0) throw new Error("解析失败");
        
        // Store in memory
        const cleanedMsgs = result.sessions.flatMap((s: any) => s.messages)
          .filter((m: any) => m.type === "text" && m.content.trim());
        addRecordsToMemory(
          cleanedMsgs.map((m: any) => ({
            id: nanoid(),
            sender: m.senderName,
            content: m.content,
            timestamp: m.timestamp,
            type: m.type,
          })),
        );
        
        setParseResult(result);
        setStep("result");
        setImageCount(0);
        
        // Match personas
        const matches: ParticipantMatch[] = [];
        for (const p of result.participants) {
          if (p === "我") continue;
          matches.push({ senderName: p, persona: null });
        }
        setParticipantMatches(matches);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "加载失败";
      setParseError(msg);
      console.warn("Test data load error:", e);
    }
  }, []);

  /** 添加到已有分身 */
  const handleAddToPersona = useCallback(
    async (persona: Persona) => {
      try {
        await addSamplesToPersona(persona.id, 30);
        Alert.alert("已添加", `聊天记录已添加到「${persona.name}」，风格摘要已更新。`, [
          { text: "好的" },
        ]);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "添加失败";
        Alert.alert("错误", msg);
      }
    },
    [],
  );

  /** 为该发送者创建新分身 */
  const handleCreateForSender = useCallback(
    (senderName: string) => {
      router.push({
        pathname: "/persona/setup",
        params: { preSelectedSender: senderName },
      });
    },
    [router],
  );

  const handleRetry = useCallback(() => {
    setFileInfo(null);
    setParseResult(null);
    setParseError(null);
    setImageCount(0);
    setParticipantMatches([]);
    setStep("select");
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* 进度指示器 */}
      <View style={styles.progressBar}>
        <StepDot active={step === "select"} done={step !== "select"} label="选择" />
        <View style={styles.progressLine} />
        <StepDot active={step === "parsing"} done={step === "result"} label="解析" />
        <View style={styles.progressLine} />
        <StepDot active={step === "result"} done={false} label="完成" />
      </View>

      <View style={styles.content}>
        {/* Step 1: 选择文件 */}
        {step === "select" && (
          <View style={styles.centerContent}>
            <Text style={styles.emoji}>📂</Text>
            <Text style={styles.title}>导入聊天记录</Text>
            <Text style={styles.subtitle}>
              支持微信导出的 TXT 和 JSON 格式{"\n"}文件大小不超过 50MB
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleSelectFile}
              disabled={isImporting}
              activeOpacity={0.7}
            >
              {isImporting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>选择文件</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.testDataBtn}
              onPress={handleLoadTestData}
              activeOpacity={0.7}
            >
              <Text style={styles.testDataBtnText}>⚡ 加载测试数据（319条情侣对话）</Text>
            </TouchableOpacity>
            {(importError || parseError) && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{importError || parseError}</Text>
                <TouchableOpacity onPress={handleRetry}>
                  <Text style={styles.retryText}>重试</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Step 2: 解析中 */}
        {step === "parsing" && (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={WECHAT_GREEN} />
            <Text style={styles.parsingTitle}>正在解析聊天记录...</Text>
            <Text style={styles.parsingFile}>{fileInfo?.fileName}</Text>
          </View>
        )}

        {/* Step 3: 结果 + 分配 */}
        {step === "result" && parseResult && (
          <ScrollView style={styles.resultScroll} contentContainerStyle={styles.resultContent}>
            <Text style={styles.resultIcon}>{"\u2713"}</Text>
            <Text style={styles.resultTitle}>解析完成</Text>

            {/* 摘要 */}
            <View style={styles.summaryCard}>
              <SummaryRow label="消息总数" value={`${parseResult.totalMessages} 条`} />
              <SummaryRow label="参与者" value={parseResult.participants.join("、")} />
              <SummaryRow
                label="时间跨度"
                value={`${formatDate(parseResult.timeSpan.start.toISOString())} ~ ${formatDate(parseResult.timeSpan.end.toISOString())}`}
              />
              <SummaryRow label="图片消息" value={`${imageCount} 张`} />
            </View>

            {/* 快捷操作：为每个非"我"的参与者创建分身 */}
            {parseResult.participants
              .filter((p) => p !== "我")
              .map((sender) => (
                <TouchableOpacity
                  key={sender}
                  style={styles.quickCreateBtn}
                  onPress={() => handleCreateForSender(sender)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickCreateIcon}>{"\u2728"}</Text>
                  <View style={styles.quickCreateTextWrap}>
                    <Text style={styles.quickCreateTitle}>
                      为「{sender}」创建 AI 分身
                    </Text>
                    <Text style={styles.quickCreateHint}>
                      从 {parseResult.totalMessages} 条消息中学习她的风格
                    </Text>
                  </View>
                  <Text style={styles.quickCreateArrow}>{">"}</Text>
                </TouchableOpacity>
              ))}

            {/* 参与者分配（已有分身时显示） */}
            {participantMatches.length > 0 && (
              <View style={styles.assignCard}>
                <Text style={styles.assignTitle}>或将记录添加到已有分身</Text>

                {participantMatches.map((m) => (
                  <View key={m.senderName} style={styles.assignItem}>
                    <View style={styles.assignInfo}>
                      <View style={styles.assignAvatar}>
                        <Text style={styles.assignAvatarTxt}>{m.senderName[0]}</Text>
                      </View>
                      <View>
                        <Text style={styles.assignSender}>{"\u300C"}{m.senderName}{"\u300D"}</Text>
                        {m.persona ? (
                          <Text style={styles.assignMatched}>
                            已匹配分身：{m.persona.name}
                          </Text>
                        ) : (
                          <Text style={styles.assignUnmatched}>未匹配到分身</Text>
                        )}
                      </View>
                    </View>

                    {m.persona ? (
                      <TouchableOpacity
                        style={styles.assignBtn}
                        onPress={() => handleAddToPersona(m.persona!)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.assignBtnText}>添加到此分身</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.assignBtnNew}
                        onPress={() => handleCreateForSender(m.senderName)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.assignBtnNewText}>创建分身</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* 返回首页或重新导入 */}
            <TouchableOpacity
              style={styles.homeBtn}
              onPress={() => router.replace("/")}
              activeOpacity={0.7}
            >
              <Text style={styles.homeBtnText}>返回首页</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.retryLink} onPress={handleRetry}>
              <Text style={styles.retryLinkText}>重新导入其他文件</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

function StepDot({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <View style={styles.stepItem}>
      <View
        style={[
          styles.stepCircle,
          (active || done) && styles.stepCircleOn,
        ]}
      >
        <Text style={[styles.stepCircleTxt, (active || done) && styles.stepCircleTxtOn]}>
          {done ? "✓" : ""}
        </Text>
      </View>
      <Text style={[styles.stepLabel, active && styles.stepLabelOn]}>{label}</Text>
    </View>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  progressBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  stepItem: { alignItems: "center" },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#CCC",
    justifyContent: "center",
    alignItems: "center",
  },
  stepCircleOn: { borderColor: WECHAT_GREEN, backgroundColor: WECHAT_GREEN },
  stepCircleTxt: { fontSize: 14, color: "#CCC" },
  stepCircleTxtOn: { color: "#fff" },
  stepLabel: { fontSize: 12, color: "#999", marginTop: 4 },
  stepLabelOn: { color: "#333", fontWeight: "600" },
  progressLine: { width: 40, height: 2, backgroundColor: "#CCC", marginHorizontal: 4 },
  content: { flex: 1 },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#191919", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#999", textAlign: "center", marginBottom: 32, lineHeight: 20 },
  primaryBtn: {
    backgroundColor: WECHAT_GREEN,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 8,
    minWidth: 200,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  testDataBtn: {
    backgroundColor: "#FFF7F0",
    borderWidth: 1,
    borderColor: "#FF9EAF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 12,
  },
  testDataBtnText: { color: "#D47A8E", fontSize: 14, fontWeight: "500", textAlign: "center" },
  errorBox: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#FFF0F0",
    borderRadius: 8,
    alignItems: "center",
    width: "100%",
  },
  errorText: { color: "#E74C3C", fontSize: 14, marginBottom: 8, textAlign: "center" },
  retryText: { color: WECHAT_GREEN, fontSize: 14, fontWeight: "600" },
  parsingTitle: { fontSize: 18, fontWeight: "600", color: "#333", marginTop: 24 },
  parsingFile: { fontSize: 14, color: "#999", marginTop: 8 },
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
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EEE",
  },
  summaryLabel: { fontSize: 14, color: "#666" },
  summaryValue: { fontSize: 14, fontWeight: "600", color: "#333" },

  // 分配卡片
  assignCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    marginBottom: 16,
  },
  assignTitle: { fontSize: 16, fontWeight: "600", color: "#191919", marginBottom: 4 },
  assignHint: { fontSize: 13, color: "#999", marginBottom: 14 },
  assignItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#EEE",
  },
  assignInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  assignAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4A90D9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  assignAvatarTxt: { color: "#fff", fontSize: 18, fontWeight: "600" },
  assignSender: { fontSize: 15, fontWeight: "500", color: "#333" },
  assignMatched: { fontSize: 12, color: WECHAT_GREEN, marginTop: 1 },
  assignUnmatched: { fontSize: 12, color: "#E74C3C", marginTop: 1 },
  assignBtn: {
    backgroundColor: WECHAT_GREEN,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  assignBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  assignBtnNew: {
    borderWidth: 1,
    borderColor: WECHAT_GREEN,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  assignBtnNewText: { color: WECHAT_GREEN, fontSize: 13, fontWeight: "600" },
  skipBtn: { paddingVertical: 12, marginBottom: 8 },
  skipBtnText: { color: "#999", fontSize: 14 },
  retryLink: { paddingVertical: 12 },
  retryLinkText: { color: WECHAT_GREEN, fontSize: 14 },

  // 快捷创建按钮
  quickCreateBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: WECHAT_GREEN,
  },
  quickCreateIcon: { fontSize: 28, marginRight: 12 },
  quickCreateTextWrap: { flex: 1 },
  quickCreateTitle: { fontSize: 16, fontWeight: "600", color: "#191919", marginBottom: 2 },
  quickCreateHint: { fontSize: 13, color: "#999" },
  quickCreateArrow: { fontSize: 18, color: "#CCC" },

  // 返回首页
  homeBtn: {
    backgroundColor: WECHAT_GREEN,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 8,
    alignItems: "center",
    minWidth: 200,
  },
  homeBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});




