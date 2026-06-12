import { useState, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getStore } from "../../modules/database/storeProvider";
import type { IDataStore } from "../../modules/database/IDataStore";

// ========== 常量（规则 3：无魔法值）==========
/** Web 端轮询间隔（useFocusEffect 在 Web 不可靠时的 fallback） */
const WEB_POLL_INTERVAL_MS = 2000;

// ========== 样式常量 ==========
const WECHAT_GREEN = "#07C160";
const PAGE_BG = "#F3F3F3";
const HER_PINK = "#FF9EAF";

export default function HomeTabScreen() {
  const router = useRouter();

  // ========== 显式状态类型（规则 4）==========
  interface HomeStats {
    messageCount: number;
    personaCount: number;
  }

  const [stats, setStats] = useState<HomeStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ========== 数据加载（规则 2：前置条件断言在 store 实现中）==========
  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const store: IDataStore = await getStore();
      const [msgCount, personas] = await Promise.all([
        store.getChatRecordCount(),
        store.getAllPersonas(),
      ]);

      // 规则 2：后置条件断言（防御性检查）
      if (typeof msgCount !== "number" || msgCount < 0) {
        throw new Error("getChatRecordCount 返回异常值");
      }
      if (!Array.isArray(personas)) {
        throw new Error("getAllPersonas 返回非数组");
      }

      setStats({ messageCount: msgCount, personaCount: personas.length });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "未知错误";
      console.error("[HomeTab] loadStats 失败:", err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 主加载：useFocusEffect
  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats]),
  );

  // Web fallback：visibilitychange + 定时轮询
  useEffect(() => {
    // 规则 6（最小实现）：只在 Web 端添加 fallback
    if (typeof document === "undefined") return;

    const handleVisible = () => {
      if (document.visibilityState === "visible") {
        loadStats();
      }
    };
    document.addEventListener("visibilitychange", handleVisible);
    const intervalId = setInterval(loadStats, WEB_POLL_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      clearInterval(intervalId);
    };
  }, [loadStats]);

  // ========== 渲染 ==========

  // 初始加载中
  if (loading && !stats) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.tagline}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 错误状态（规则 7：失败快速 — 显示错误而不是空数据）
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>数据加载失败</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadStats}
            activeOpacity={0.7}
          >
            <Text style={styles.retryText}>点击重试</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 正常渲染
  const { messageCount, personaCount } = stats!;

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>💕</Text>
        </View>
        <Text style={styles.appName}>AI 聊天分身</Text>
        <Text style={styles.tagline}>留住那些温柔的对话</Text>
      </View>

      {/* 数据概览 */}
      <View style={styles.statsCard}>
        <StatRow icon="💬" label="已导入消息" value={`${messageCount} 条`} />
        <StatSep />
        <StatRow icon="👤" label="AI 分身" value={`${personaCount} 个`} />
      </View>

      {/* 快捷操作 */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push("/import")}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, { backgroundColor: "#FFF0F3" }]}>
            <Text style={styles.actionIconText}>📂</Text>
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionLabel}>导入聊天记录</Text>
            <Text style={styles.actionHint}>导入微信导出的 TXT/JSON</Text>
          </View>
          <Text style={styles.actionArrow}>{">"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push("/persona/setup")}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, { backgroundColor: "#FFF0F3" }]}>
            <Text style={styles.actionIconText}>✨</Text>
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionLabel}>创建 AI 分身</Text>
            <Text style={styles.actionHint}>
              {messageCount > 0
                ? `已有 ${messageCount} 条消息可供学习`
                : "请先导入聊天记录"}
            </Text>
          </View>
          <Text style={styles.actionArrow}>{">"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push("/(tabs)/settings")}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, { backgroundColor: "#F0F0F0" }]}>
            <Text style={styles.actionIconText}>⚙️</Text>
          </View>
          <View style={styles.actionInfo}>
            <Text style={styles.actionLabel}>系统设置</Text>
            <Text style={styles.actionHint}>API Key、个人资料、表情包</Text>
          </View>
          <Text style={styles.actionArrow}>{">"}</Text>
        </TouchableOpacity>
      </View>

      {/* 底部提示 — 只在确认 messageCount === 0 时显示 */}
      {messageCount === 0 && (
        <View style={styles.hintCard}>
          <Text style={styles.hintIcon}>📱</Text>
          <Text style={styles.hintText}>
            还没有导入聊天记录{"\n"}从微信导出你和她的对话即可开始
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ========== 子组件 ==========

function StatRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function StatSep() {
  return <View style={styles.statSep} />;
}

// ========== 样式 ==========
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    color: "#E74C3C",
    fontWeight: "600",
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 13,
    color: "#999999",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: WECHAT_GREEN,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  // 头部
  header: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 24,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: HER_PINK,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#FF9EAF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  logoEmoji: {
    fontSize: 34,
  },
  appName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#191919",
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: "#999999",
  },

  // 数据卡片
  statsCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  statIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  statLabel: {
    flex: 1,
    fontSize: 15,
    color: "#666666",
  },
  statValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#191919",
  },
  statSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EEEEEE",
    marginVertical: 4,
    marginLeft: 28,
  },

  // 快捷操作
  actions: {
    paddingHorizontal: 20,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  actionIconText: {
    fontSize: 22,
  },
  actionInfo: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#191919",
    marginBottom: 2,
  },
  actionHint: {
    fontSize: 12,
    color: "#999999",
  },
  actionArrow: {
    fontSize: 18,
    color: "#CCCCCC",
    marginLeft: 8,
  },

  // 底部提示
  hintCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "#FFF8F8",
    borderRadius: 12,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFE4E1",
  },
  hintIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    color: "#999999",
    lineHeight: 20,
  },
});
