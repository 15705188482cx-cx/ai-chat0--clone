import { useState, useEffect, useCallback } from "react";
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
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "../../modules/config/webStorage";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getAvailableSenders,
  createPersona,
} from "../../modules/persona/personaService";
import { getSampleBySender } from "../../modules/database/repositories/chatRecordRepo";
import {
  getMemoryDistinctSenders,
  addPersonaToMemory,
  getMemorySamplesBySender,
  isWeb,
} from "../../modules/database/memoryFallback";
import { analyzeStyleFull, analyzeStyle } from "../../modules/aiEngine/styleAnalyzer";
import type { Persona } from "../../modules/persona/types";
import { useChatStore } from "../../stores/chatStore";

const WECHAT_GREEN = "#07C160";
const BG_GRAY = "#EDEDED";
const HER_AVATAR_BG = "#FF9EAF";
const PINK = "#FFE4E1";

export default function PersonaSetupScreen() {
  const router = useRouter();
  const { preSelectedSender } = useLocalSearchParams<{ preSelectedSender?: string }>();
  const { initConversation, setPersonaAndInitConversation } = useChatStore();

  const [senders, setSenders] = useState<string[]>([]);
  const [selectedSender, setSelectedSender] = useState<string | null>(null);
  const [personaName, setPersonaName] = useState("");
  const [personaSignature, setPersonaSignature] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [styleSummary, setStyleSummary] = useState<string | null>(null);
  const [personaExtraInfo, setPersonaExtraInfo] = useState("");
  const [personaLayers, setPersonaLayers] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
      (async () => {
      try {
        const names = await getAvailableSenders().catch(() => [] as string[]);
        // 如果 DB 返回空（Web 环境），从内存 fallback 读取
        const allNames = names.length > 0 ? names : getMemoryDistinctSenders();
        // 过滤掉我，只保留可模仿的对象
        const filtered = allNames.filter((n) => n !== "我");
        setSenders(filtered);

        // 如果从导入页传入预选发送者，自动选中
        if (preSelectedSender && filtered.includes(preSelectedSender)) {
          setSelectedSender(preSelectedSender);
          setPersonaName(preSelectedSender);
        }

        if (filtered.length === 0) {
          setError(
            names.length > 0
              ? '未找到除"我"以外的联系人，请确认聊天记录中包含对方的消息'
              : "未找到聊天记录，请先导入文件",
          );
        }
      } catch {
        setError("加载参与者列表失败");
      } finally {
        setLoading(false);
      }
      })();
  }, [preSelectedSender]);

  // 选择她后自动分析风格
  const handleSelectSender = useCallback(
    async (name: string) => {
      setSelectedSender(name);
      setPersonaName(name);
      setStyleSummary(null);
      setAvatarUri(null);
      setPersonaSignature("");

      setAnalyzing(true);
      try {
        let texts: string[] = [];
        try {
          const samples = await getSampleBySender(name, 20);
          if (samples.length > 0) {
            texts = samples.map((s) => s.content);
          }
        } catch {
          // DB 不可用
        }
        // 如果 DB 返回空，尝试内存 fallback
        if (texts.length === 0) {
          texts = getMemorySamplesBySender(name, 20);
        }
        if (texts.length > 0) {
          // 15秒超时保护，防止API卡死
          const result = await Promise.race<{ styleSummary: string; layers: Record<string, any> }>([
            analyzeStyleFull(texts, personaExtraInfo),
            new Promise((_, reject) => setTimeout(() => reject(new Error("分析超时")), 15000)),
          ]);
          setStyleSummary(result.styleSummary);
          if (result.layers && Object.keys(result.layers).length > 0) {
            setPersonaLayers(result.layers);
        }
        }
      } catch {
        // 分析失败不阻塞流程
      } finally {
        setAnalyzing(false);
      }
    },
    [personaExtraInfo],
  );

    useEffect(() => {
      if (preSelectedSender && selectedSender === preSelectedSender && !styleSummary && !analyzing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleSelectSender(preSelectedSender);
      }
  }, [preSelectedSender, selectedSender]);

  const handlePickAvatar = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("权限不足", "需要相册权限才能选择头像");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setAvatarUri(result.assets[0].uri);
    }
  }, []);

  const handleCreate = useCallback(async () => {
    if (!selectedSender) return;
    setCreating(true);
    setError(null);
    try {
      const name = personaName.trim() || selectedSender;

      let persona: Persona;
      if (isWeb()) {
        // Web 端：跳过 DB，直接用内存数据创建分身
        persona = {
          id: "web-persona-" + Date.now(),
          name,
          sourceSender: selectedSender,
          chatSampleIds: [],
          styleSummary: styleSummary ?? "（从内存分析）",
          createdAt: new Date().toISOString(),
        };
        addPersonaToMemory(persona);
      } else {
        persona = await createPersona({
          name,
          sourceSender: selectedSender,
          sampleCount: 20,
          extraInfo: personaExtraInfo,
        });
      }

      if (avatarUri) {
        await SecureStore.setItemAsync(
          `persona_avatar_${persona.id}`,
          avatarUri,
        );
      }
      if (personaSignature.trim()) {
        await SecureStore.setItemAsync(
          `persona_signature_${persona.id}`,
          personaSignature.trim(),
        );
      }

      if (isWeb()) { await setPersonaAndInitConversation(persona); } else { await initConversation(persona.id); }
      router.replace(`/chat/${useChatStore.getState().conversationId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "创建失败";
      setError(msg);
    } finally {
      setCreating(false);
    }
  }, [
    selectedSender,
    personaName,
    personaSignature,
    avatarUri,
    initConversation,
    setPersonaAndInitConversation,
    router,
  ]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={WECHAT_GREEN} />
        <Text style={styles.loadingText}>加载联系人...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* 标题 */}
        <Text style={styles.title}>创建她的 AI 分身</Text>
        <Text style={styles.subtitle}>
          AI 将学习她的说话方式，让你们继续聊天        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* 步骤1：选择她*/}
        <Text style={styles.stepLabel}>选择她</Text>
        <View style={styles.senderList}>
          {senders.map((name) => (
            <TouchableOpacity
              key={name}
              style={[
                styles.senderItem,
                selectedSender === name && styles.senderItemActive,
              ]}
              onPress={() => handleSelectSender(name)}
              activeOpacity={0.6}
            >
              <View
                style={[
                  styles.senderAvatar,
                  selectedSender === name && styles.senderAvatarActive,
                ]}
              >
                <Text style={styles.senderAvatarText}>{name[0]}</Text>
              </View>
              <View style={styles.senderInfo}>
                <Text style={styles.senderName}>{name}</Text>
                <Text style={styles.senderHint}>
                  {selectedSender === name ? "已选择" : "点击选择"}
                </Text>
              </View>
              {selectedSender === name && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}

          {senders.length === 0 && !error && (
            <View style={styles.emptySender}>
              <Text style={styles.emptyText}>暂无可选联系人</Text>
              <TouchableOpacity onPress={() => router.push("/import")}>
                <Text style={styles.linkText}>去导入聊天记录</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 步骤2：设置她的样子*/}
        {selectedSender && (
          <View style={styles.configSection}>
            <Text style={styles.stepLabel}>设置她的样子</Text>

            <View style={styles.configCard}>
              {/* 头像 - 圆形80x80 */}
              <TouchableOpacity
                style={styles.avatarPickerWrap}
                onPress={handlePickAvatar}
                activeOpacity={0.7}
              >
                <View style={styles.avatarCircle}>
                  {avatarUri ? (
                    <Image
                      source={{ uri: avatarUri }}
                      style={styles.avatarCircleImage}
                    />
                  ) : (
                    <Text style={styles.avatarCircleText}>
                      {selectedSender[0]}
                    </Text>
                  )}
                </View>
                <Text style={styles.avatarHint}>点击设置头像</Text>
              </TouchableOpacity>

              <View style={styles.configFields}>
                {/* 昵称 */}
                <View style={styles.configRow}>
                  <Text style={styles.configLabel}>昵称</Text>
                  <TextInput
                    style={styles.configInput}
                    value={personaName}
                    onChangeText={setPersonaName}
                    placeholder={selectedSender}
                    placeholderTextColor="#CCC"
                  />
                </View>

                <RowSeparator />

                {/* 个性签名*/}
                <View style={styles.configRow}>
                  <Text style={styles.configLabel}>签名</Text>
                  <TextInput
                    style={styles.configInput}
                    value={personaSignature}
                    onChangeText={setPersonaSignature}
                    placeholder="她的个性签名（可选）"
                    placeholderTextColor="#CCC"
                  />
                </View>
              </View>
            </View>

            {/* 步骤3：她的说话风格*/}
            <Text style={styles.stepLabel}>她的说话风格</Text>
            <View style={styles.styleCard}>
              {analyzing ? (
                <View style={styles.analyzingWrap}>
                  <ActivityIndicator size="small" color={WECHAT_GREEN} />
                  <Text style={styles.analyzingText}>
                    正在分析她的说话风格...
                  </Text>
                </View>
              ) : styleSummary ? (
                <Text style={styles.styleText}>{styleSummary}</Text>
              ) : (
                <Text style={styles.styleHint}>
                  AI 将分析她的聊天记录，学习她的语气和习惯                </Text>
              )}
            </View>

            {/* 创建按钮 */}
            <TouchableOpacity
              style={[
                styles.createButton,
                creating && styles.createButtonDisabled,
              ]}
              onPress={handleCreate}
              disabled={creating}
              activeOpacity={0.7}
            >
              {creating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.createButtonText}>✨  创建</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RowSeparator() {
  return <View style={styles.rowSeparator} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_GRAY,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BG_GRAY,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // 标题
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#191919",
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  subtitle: {
    fontSize: 14,
    color: "#999999",
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#999999",
  },

  // 错误
  errorBox: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    backgroundColor: "#FFF0F0",
    borderRadius: 8,
  },
  errorText: {
    color: "#E74C3C",
    fontSize: 14,
    textAlign: "center",
  },

  // 步骤标签
  stepLabel: {
    fontSize: 13,
    color: "#888888",
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 20,
  },

  // 发送者列表
  senderList: {
    paddingHorizontal: 0,
  },
  senderItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5E5",
  },
  senderItemActive: {
    backgroundColor: "#FFF0F3",
  },
  senderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#4A90D9",
    justifyContent: "center",
    alignItems: "center",
  },
  senderAvatarActive: {
    backgroundColor: HER_AVATAR_BG,
  },
  senderAvatarText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "600",
  },
  senderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  senderName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#191919",
  },
  senderHint: {
    fontSize: 12,
    color: "#B0B0B0",
    marginTop: 2,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: WECHAT_GREEN,
    justifyContent: "center",
    alignItems: "center",
  },
  checkmarkText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  emptySender: {
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    color: "#999999",
    marginBottom: 8,
  },
  linkText: {
    fontSize: 16,
    color: WECHAT_GREEN,
    fontWeight: "600",
  },

  // 配置区
  configSection: {
    marginTop: 8,
    paddingHorizontal: 0,
  },
  configCard: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E5E5",
  },

  // 圆形头像选择器
  avatarPickerWrap: {
    alignItems: "center",
    paddingVertical: 20,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: HER_AVATAR_BG,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: PINK,
  },
  avatarCircleImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarCircleText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "600",
  },
  avatarHint: {
    marginTop: 8,
    fontSize: 13,
    color: "#999999",
  },

  // 配置字段
  configFields: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E5E5",
  },
  configRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 48,
  },
  configLabel: {
    fontSize: 16,
    color: "#191919",
    flexShrink: 0,
  },
  configInput: {
    flex: 1,
    textAlign: "right",
    fontSize: 15,
    color: "#191919",
    paddingVertical: 0,
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E5E5",
    marginLeft: 20,
  },

  // 风格预览
  styleCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E5E5",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  analyzingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  analyzingText: {
    fontSize: 14,
    color: "#999999",
  },
  styleText: {
    fontSize: 14,
    color: "#333333",
    lineHeight: 22,
  },
  styleHint: {
    fontSize: 14,
    color: "#B0B0B0",
    fontStyle: "italic",
  },

  // 创建按钮
  createButton: {
    backgroundColor: WECHAT_GREEN,
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
});

