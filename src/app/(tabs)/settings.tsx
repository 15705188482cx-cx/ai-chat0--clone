import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  setApiKey,
  getApiKey,
  deleteApiKey,
} from "../../modules/config/apiKeyManager";
import { getRateLimiter } from "../../modules/aiEngine/rateLimiter";
import { getCount } from "../../modules/database/repositories/chatRecordRepo";
import { DISCLAIMER_TEXT } from "../../modules/aiEngine/contentFilter";
import { getAllPersonas } from "../../modules/persona/personaService";
import type { Persona } from "../../modules/persona/types";
import * as SecureStore from "../../modules/config/webStorage";
import { StickerPickerModal } from "../../components/StickerPickerModal";

const WECHAT_GREEN = "#07C160";
const PAGE_BG = "#F3F3F3";

const USER_NICKNAME_KEY = "user_nickname";
const USER_SIGNATURE_KEY = "user_signature";
const USER_AVATAR_KEY = "user_avatar_uri";

interface PersonaProfile {
  persona: Persona;
  avatarUri: string | null;
  signature: string;
}

export default function SettingsScreen() {
  const router = useRouter();
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [rateLimitRemaining, setRateLimitRemaining] = useState(50);

  // 用户资料
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [signature, setSignature] = useState("");
  const [showNicknameInput, setShowNicknameInput] = useState(false);
  const [showSignatureInput, setShowSignatureInput] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [signatureDraft, setSignatureDraft] = useState("");

  // 所有分身资料（支持多个）
  const [personaProfiles, setPersonaProfiles] = useState<PersonaProfile[]>([]);

  // 表情包弹窗
  const [stickerModalVisible, setStickerModalVisible] = useState(false);

  useEffect(() => {
    (async () => {
      const key = await getApiKey();
      setHasKey(!!key);
      const count = await getCount();
      setMessageCount(count);
      // rateLimiter 是内存滑动窗口，App 重启后重置
      setRateLimitRemaining(getRateLimiter().remaining);

      // 加载用户资料
      const savedAvatar = await SecureStore.getItemAsync(USER_AVATAR_KEY);
      if (savedAvatar) setAvatarUri(savedAvatar);
      const savedNickname = await SecureStore.getItemAsync(USER_NICKNAME_KEY);
      if (savedNickname) setNickname(savedNickname);
      const savedSignature = await SecureStore.getItemAsync(USER_SIGNATURE_KEY);
      if (savedSignature) setSignature(savedSignature);

      // 加载所有分身
      const personas = await getAllPersonas();
      const profiles: PersonaProfile[] = [];
      for (const p of personas) {
        const avatar = await SecureStore.getItemAsync(`persona_avatar_${p.id}`);
        const sig = await SecureStore.getItemAsync(`persona_signature_${p.id}`);
        profiles.push({
          persona: p,
          avatarUri: avatar,
          signature: sig || "",
        });
      }
      setPersonaProfiles(profiles);
    })();
  }, []);

  // --- 用户资料操作 ---

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
      const uri = result.assets[0].uri;
      setAvatarUri(uri);
      await SecureStore.setItemAsync(USER_AVATAR_KEY, uri);
    }
  }, []);

  const handleSaveNickname = useCallback(async () => {
    const trimmed = nicknameDraft.trim();
    if (trimmed) {
      setNickname(trimmed);
      await SecureStore.setItemAsync(USER_NICKNAME_KEY, trimmed);
    }
    setShowNicknameInput(false);
  }, [nicknameDraft]);

  const handleSaveSignature = useCallback(async () => {
    const trimmed = signatureDraft.trim();
    setSignature(trimmed);
    if (trimmed) {
      await SecureStore.setItemAsync(USER_SIGNATURE_KEY, trimmed);
    } else {
      await SecureStore.deleteItemAsync(USER_SIGNATURE_KEY);
    }
    setShowSignatureInput(false);
  }, [signatureDraft]);

  // --- 分身操作 ---

  const handlePickPersonaAvatar = useCallback(
    async (personaId: string) => {
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
        const uri = result.assets[0].uri;
        await SecureStore.setItemAsync(`persona_avatar_${personaId}`, uri);
        setPersonaProfiles((prev) =>
          prev.map((p) =>
            p.persona.id === personaId ? { ...p, avatarUri: uri } : p,
          ),
        );
      }
    },
    [],
  );

  const handleEditPersonaSignature = useCallback(
    (personaId: string, text: string) => {
      const trimmed = text.trim();
      SecureStore.setItemAsync(`persona_signature_${personaId}`, trimmed);
      setPersonaProfiles((prev) =>
        prev.map((p) =>
          p.persona.id === personaId
            ? { ...p, signature: trimmed }
            : p,
        ),
      );
    },
    [],
  );

  // --- API Key ---

  const handleSaveKey = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) return;
    await setApiKey(trimmed);
    setHasKey(true);
    setApiKeyInput("");
    Alert.alert("已保存", "API Key 已安全存储");
  };

  const handleDeleteKey = async () => {
    if (typeof window !== 'undefined' && window.confirm) {
      if (!window.confirm('确定删除 API Key？删除后 AI 回复功能将不可用。')) return;
    }
    await deleteApiKey();
    setHasKey(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* --- 我的资料 --- */}
        <Text style={styles.sectionHeader}>我的</Text>
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.profileRow}
            onPress={handlePickAvatar}
            activeOpacity={0.6}
          >
            <Text style={styles.rowLabel}>头像</Text>
            <View style={styles.rowRight}>
              <View style={styles.userAvatar}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.placeholder}>👤</Text>
                )}
              </View>
              <Text style={styles.arrow}>{'>'}</Text>
            </View>
          </TouchableOpacity>
          <RowSeparator />
          <TouchableOpacity
            style={styles.profileRow}
            onPress={() => {
              setNicknameDraft(nickname);
              setShowNicknameInput(true);
            }}
            activeOpacity={0.6}
          >
            <Text style={styles.rowLabel}>昵称</Text>
            <View style={styles.rowRight}>
              {showNicknameInput ? (
                <TextInput
                  style={styles.inlineInput}
                  value={nicknameDraft}
                  onChangeText={setNicknameDraft}
                  autoFocus
                  onBlur={handleSaveNickname}
                  onSubmitEditing={handleSaveNickname}
                />
              ) : (
                <>
                  <Text style={styles.rowValue}>{nickname || "未设置"}</Text>
                  <Text style={styles.arrow}>{'>'}</Text>
                </>
              )}
            </View>
          </TouchableOpacity>
          <RowSeparator />
          <TouchableOpacity
            style={styles.profileRow}
            onPress={() => {
              setSignatureDraft(signature);
              setShowSignatureInput(true);
            }}
            activeOpacity={0.6}
          >
            <Text style={styles.rowLabel}>签名</Text>
            <View style={styles.rowRight}>
              {showSignatureInput ? (
                <TextInput
                  style={styles.inlineInput}
                  value={signatureDraft}
                  onChangeText={setSignatureDraft}
                  autoFocus
                  onBlur={handleSaveSignature}
                  onSubmitEditing={handleSaveSignature}
                  placeholder="写下你的个性签名"
                  placeholderTextColor="#CCC"
                />
              ) : (
                <>
                  <Text style={styles.rowValue} numberOfLines={1}>
                    {signature || "未设置"}
                  </Text>
                  <Text style={styles.arrow}>{'>'}</Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* --- 她的分身 --- */}
        <Text style={styles.sectionHeader}>她的分身</Text>
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => router.push("/persona/manage")}
            activeOpacity={0.6}
          >
            <Text style={styles.rowLabel}>管理分身</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>
                {personaProfiles.length > 0
                  ? `${personaProfiles.length} 个分身`
                  : "未创建"}
              </Text>
              <Text style={styles.arrow}>{'>'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* --- AI 配置 --- */}
        <Text style={styles.sectionHeader}>AI 配置</Text>
        <View style={styles.sectionCard}>
          <View style={styles.apiKeyRow}>
            <View style={styles.apiKeyInfo}>
              <Text style={styles.rowLabel}>DeepSeek API Key</Text>
              {hasKey ? (
                <Text style={styles.keyStatus}>已配置</Text>
              ) : (
                <Text style={styles.keyStatusMissing}>未配置</Text>
              )}
            </View>
            {hasKey ? (
              <TouchableOpacity onPress={handleDeleteKey}>
                <Text style={styles.deleteKeyText}>删除</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {!hasKey && (
            <View style={styles.apiKeyInputWrap}>
              <TextInput
                style={styles.apiKeyInput}
                value={apiKeyInput}
                onChangeText={setApiKeyInput}
                placeholder="sk-xxxxxxxxxxxxx"
                secureTextEntry
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[
                  styles.saveKeyButton,
                  !apiKeyInput.trim() && styles.saveKeyButtonDisabled,
                ]}
                onPress={handleSaveKey}
                disabled={!apiKeyInput.trim()}
              >
                <Text style={styles.saveKeyButtonText}>保存</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* --- 表情包 --- */}
        <Text style={styles.sectionHeader}>表情包</Text>
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setStickerModalVisible(true)}
            activeOpacity={0.6}
          >
            <Text style={styles.rowLabel}>管理表情包</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>查看/导入</Text>
              <Text style={styles.arrow}>{'>'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* --- 数据 --- */}
        <Text style={styles.sectionHeader}>数据</Text>
        <View style={styles.sectionCard}>
          <View style={styles.menuRow}>
            <Text style={styles.rowLabel}>已导入消息</Text>
            <Text style={styles.rowValue}>{messageCount} 条</Text>
          </View>
          <RowSeparator />
          <View style={styles.menuRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>API 调用频率</Text>
              <Text style={styles.dataSourceHint}>
                来源：内存滑动窗口计数器（App 重启后重置）
              </Text>
            </View>
            <Text style={styles.rowValue}>
              {rateLimitRemaining} / 50 次/小时
            </Text>
          </View>
        </View>

        {/* --- 关于 --- */}
        <Text style={styles.sectionHeader}>关于</Text>
        <View style={styles.sectionCard}>
          <Text style={styles.disclaimer}>{DISCLAIMER_TEXT}</Text>
        </View>

        <Text style={styles.version}>AI 聊天分身 v0.1.0 · 内部测试版</Text>
      </ScrollView>

      {/* 表情包管理弹窗 */}
      <StickerPickerModal
        visible={stickerModalVisible}
        onClose={() => setStickerModalVisible(false)}
        onSelect={() => setStickerModalVisible(false)}
      />
    </SafeAreaView>
  );
}

function RowSeparator() {
  return <View style={styles.rowSeparator} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  content: { paddingBottom: 40 },

  sectionHeader: {
    fontSize: 13,
    color: "#888",
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  sectionCard: {
    backgroundColor: "#FFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E5E5",
  },
  cardGap: { height: 12 },

  // 行
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 48,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 48,
  },
  rowLabel: { fontSize: 16, color: "#191919", flexShrink: 0 },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end",
    marginLeft: 16,
  },
  rowValue: { fontSize: 15, color: "#999", textAlign: "right" },
  arrow: { fontSize: 16, color: "#CCC", marginLeft: 8, fontWeight: "300" },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E5E5",
    marginLeft: 20,
  },

  // 分身名称行
  personaNameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#FAFAFA",
  },
  personaNameLabel: { fontSize: 14, fontWeight: "600", color: "#333" },
  personaSource: { fontSize: 12, color: "#999" },
  innerSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E5E5",
  },

  // 用户头像（方形圆角）
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 4,
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 56, height: 56, borderRadius: 4 },
  placeholder: { fontSize: 28 },

  // 她头像（圆形，匹配Demo）
  herAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FF9EAF",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  herAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  herAvatarTxt: { color: "#FFF", fontSize: 18, fontWeight: "600" },

  inlineInput: {
    flex: 1,
    textAlign: "right",
    fontSize: 15,
    color: "#191919",
    paddingVertical: 0,
  },

  // API Key
  apiKeyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  apiKeyInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  keyStatus: { fontSize: 13, color: WECHAT_GREEN, fontWeight: "500" },
  keyStatusMissing: { fontSize: 13, color: "#E74C3C", fontWeight: "500" },
  deleteKeyText: { fontSize: 14, color: "#E74C3C" },
  apiKeyInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 8,
  },
  apiKeyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "#FAFAFA",
  },
  saveKeyButton: {
    backgroundColor: WECHAT_GREEN,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  saveKeyButtonDisabled: { opacity: 0.4 },
  saveKeyButtonText: { color: "#FFF", fontSize: 14, fontWeight: "600" },

  // 数据来源标注
  dataSourceHint: {
    fontSize: 11,
    color: "#BBB",
    marginTop: 2,
  },

  disclaimer: {
    fontSize: 13,
    color: "#999",
    lineHeight: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  version: {
    textAlign: "center",
    color: "#CCC",
    fontSize: 12,
    marginTop: 32,
    marginBottom: 16,
  },
});
