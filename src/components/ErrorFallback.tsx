import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

// ========== 颜色常量（规则 3：无魔法值）==========
const COLORS = {
  background: "#EDEDED",
  danger: "#FF6B6B",
  textPrimary: "#333333",
  textSecondary: "#666666",
  brand: "#07C160",
  white: "#FFFFFF",
} as const;

interface ErrorFallbackProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorFallback({
  message = "出了点问题",
  onRetry,
}: ErrorFallbackProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>!</Text>
      <Text style={styles.title}>出错了</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>重试</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={styles.homeButton}
        onPress={() => router.replace("/")}
      >
        <Text style={styles.homeText}>返回首页</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    padding: 32,
  },
  icon: {
    fontSize: 48,
    color: COLORS.danger,
    fontWeight: "700",
    marginBottom: 16,
    width: 64,
    height: 64,
    lineHeight: 64,
    textAlign: "center",
    borderWidth: 3,
    borderColor: COLORS.danger,
    borderRadius: 32,
    overflow: "hidden",
  },
  title: { fontSize: 20, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 8 },
  message: { fontSize: 14, color: COLORS.textSecondary, textAlign: "center", marginBottom: 24 },
  retryButton: {
    backgroundColor: COLORS.brand,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryText: { color: COLORS.white, fontSize: 16, fontWeight: "600" },
  homeButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  homeText: { color: COLORS.brand, fontSize: 16 },
});
