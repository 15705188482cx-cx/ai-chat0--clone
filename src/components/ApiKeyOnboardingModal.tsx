// =============================================================================
// ApiKeyOnboardingModal - 首启动引导用户填写 DeepSeek API Key
// 规则 6(最小实现): 用户点"跳过"则不强制,只是提示对话不可用
// 行为: 用户保存后调 onSaved 通知父组件刷新状态
// =============================================================================

import { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  setApiKey,
  getApiKey,
} from "../modules/config/apiKeyManager";

interface Props {
  visible: boolean;
  onSaved: () => void;
  onSkip: () => void;
}

export function ApiKeyOnboardingModal({ visible, onSaved, onSkip }: Props) {
  const [input, setInput] = useState("");
  const [hasExisting, setHasExisting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const existing = await getApiKey();
        setHasExisting(!!existing);
        if (existing) setInput(existing);
      } catch {
        // 忽略
      }
    })();
  }, [visible]);

  const handleSave = async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      Alert.alert("提示", "请输入 DeepSeek API Key");
      return;
    }
    setSaving(true);
    try {
      await setApiKey(trimmed);
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "保存失败";
      Alert.alert("保存失败", msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onSkip}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.icon}>🔑</Text>
          <Text style={styles.title}>配置 DeepSeek API Key</Text>
          <Text style={styles.desc}>
            {`填入后才能让 AI 分身生成回复。
后续也可在「设置」中修改。`}
          </Text>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="sk-xxxxxxxx"
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          {hasExisting && (
            <Text style={styles.hint}>
              {"已检测到你以前填过的 Key，直接点保存可覆盖"}
            </Text>
          )}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={onSkip}
              activeOpacity={0.7}
              disabled={saving}
            >
              <Text style={styles.btnGhostText}>暂跳过</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, saving && styles.btnDisabled]}
              onPress={handleSave}
              activeOpacity={0.7}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryText}>保存</Text>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.footer}>
            {
              "安全说明:Key 使用 SecureStore 加密存储，仅本机可读。"
            }
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  icon: { fontSize: 36, textAlign: "center", marginBottom: 8 },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#191919",
    textAlign: "center",
    marginBottom: 8,
  },
  desc: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#191919",
    backgroundColor: "#FAFAFA",
    marginBottom: 8,
  },
  hint: { fontSize: 12, color: "#999999", marginBottom: 8 },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  btnGhostText: { color: "#888888", fontSize: 15, fontWeight: "500" },
  btnPrimary: { backgroundColor: "#07C160" },
  btnDisabled: { opacity: 0.5 },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  footer: {
    fontSize: 11,
    color: "#BBBBBB",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 16,
  },
});
