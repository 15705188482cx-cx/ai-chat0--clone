import { useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCount } from "../../modules/database/repositories/chatRecordRepo";
import { getMemoryCount } from "../../modules/database/memoryFallback";
import { getAllPersonas } from "../../modules/persona/personaService";

const WECHAT_GREEN = "#07C160";
const PAGE_BG = "#F3F3F3";
const HER_PINK = "#FF9EAF";

export default function HomeTabScreen() {
  const router = useRouter();
  const [stats, setStats] = useState({
    messageCount: 0,
    personaCount: 0,
  });

  const loadStats = useCallback(async () => {
    const count = await getCount().catch(() => 0);
    const total = count || getMemoryCount();
    const personas = await getAllPersonas().catch(() => []);
    setStats({
      messageCount: total,
      personaCount: personas.length,
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats]),
  );

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
        <StatRow icon="💬" label="已导入消息" value={`${stats.messageCount} 条`} />
        <StatSep />
        <StatRow icon="👤" label="AI 分身" value={`${stats.personaCount} 个`} />
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
          <Text style={styles.actionArrow}>{'>'}</Text>
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
              {stats.messageCount > 0
                ? `已有 ${stats.messageCount} 条消息可供学习`
                : "请先导入聊天记录"}
            </Text>
          </View>
          <Text style={styles.actionArrow}>{'>'}</Text>
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
          <Text style={styles.actionArrow}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      {/* 底部提示 */}
      {stats.messageCount === 0 && (
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
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
