import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

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
    backgroundColor: "#EDEDED",
    padding: 32,
  },
  icon: {
    fontSize: 48,
    color: "#FF6B6B",
    fontWeight: "700",
    marginBottom: 16,
    width: 64,
    height: 64,
    lineHeight: 64,
    textAlign: "center",
    borderWidth: 3,
    borderColor: "#FF6B6B",
    borderRadius: 32,
    overflow: "hidden",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#333", marginBottom: 8 },
  message: { fontSize: 14, color: "#666", textAlign: "center", marginBottom: 24 },
  retryButton: {
    backgroundColor: "#07C160",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  homeButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  homeText: { color: "#07C160", fontSize: 16 },
});
