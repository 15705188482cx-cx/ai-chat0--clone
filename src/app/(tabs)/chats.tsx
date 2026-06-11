import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ActionSheetIOS,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getAllConversations,
  deleteConversation,
} from "../../modules/database/repositories/conversationRepo";
import { getLatestMessages } from "../../modules/database/repositories/messageRepo";
import { getPersonaById, getAllPersonas } from "../../modules/persona/personaService";
import { getDistinctSenders } from "../../modules/database/repositories/chatRecordRepo";
import { formatDate } from "../../utils/dateFormat";

const WECHAT_GREEN = "#07C160";
const PAGE_BG = "#F3F3F3";
const AVATAR_SIZE = 48;

interface ConversationItem {
  id: string;
  personaName: string;
  title: string;
  lastMessage: string;
  updatedAt: string;
}

async function loadConversations(): Promise<ConversationItem[]> {
  const convs = await getAllConversations();
  const items: ConversationItem[] = [];
  for (const c of convs) {
    const persona = await getPersonaById(c.persona_id);
    let lastMsg = "";
    try {
      const msgs = await getLatestMessages(c.id, 1);
      if (msgs.length > 0) {
        lastMsg = msgs[0].text_content || "";
      }
    } catch {
      // 静默处理
    }
    items.push({
      id: c.id,
      personaName: persona?.name ?? "未知",
      title: c.title || persona?.name || "对话",
      lastMessage: lastMsg,
      updatedAt: c.updated_at,
    });
  }
  return items;
}

export default function ConversationListScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await loadConversations();
      setConversations(items);
    } catch {
      // 静默处理
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleDelete = useCallback(
    (id: string, title: string) => {
      Alert.alert("删除会话", `确认删除「${title}」？`, [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: async () => {
            await deleteConversation(id);
            load();
          },
        },
      ]);
    },
    [load],
  );

  /** "+" 按钮：智能路由 */
  const handleFabPress = useCallback(async () => {
    const senders = await getDistinctSenders();
    if (senders.length === 0) {
      // 没有任何聊天记录 → 先去导入
      router.push("/import");
      return;
    }

    const personas = await getAllPersonas();
    if (personas.length === 0) {
      // 有聊天记录但没创建过分身 → 直接去创建
      router.push("/persona/setup");
      return;
    }

    // 已有分身 → 让用户选择下一步
    const options = ["导入新的聊天记录", "创建新的分身", "取消"];
    const destructiveIndex = undefined;
    const cancelIndex = 2;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex },
        (index) => {
          if (index === 0) router.push("/import");
          if (index === 1) router.push("/persona/setup");
        },
      );
    } else {
      // Android: 使用 Alert 模拟（原生 ActionSheet 也可用，这里简化）
      Alert.alert("新建", "选择操作", [
        { text: "导入新的聊天记录", onPress: () => router.push("/import") },
        { text: "创建新的分身", onPress: () => router.push("/persona/setup") },
        { text: "取消", style: "cancel" },
      ]);
    }
  }, [router]);

  const renderItem = ({ item }: { item: ConversationItem }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => router.push(`/chat/${item.id}`)}
      onLongPress={() => handleDelete(item.id, item.title)}
      activeOpacity={0.6}
    >
      {/* 头像 */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.personaName[0]}</Text>
      </View>

      {/* 中间内容 */}
      <View style={styles.itemCenter}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.itemPreview} numberOfLines={1}>
          {item.lastMessage || "暂无消息"}
        </Text>
      </View>

      {/* 右侧时间 */}
      <View style={styles.itemRight}>
        <Text style={styles.itemTime}>{formatDate(item.updatedAt)}</Text>
        <View style={styles.itemBadgePlaceholder} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 顶部标题 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>会话</Text>
      </View>

      {/* 列表 */}
      {loading ? (
        <ActivityIndicator
          size="large"
          color={WECHAT_GREEN}
          style={{ marginTop: 80 }}
        />
      ) : conversations.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>💕</Text>
          <Text style={styles.emptyTitle}>还没有对话</Text>
          <Text style={styles.emptySubtext}>
            导入和她的聊天记录，创建她的 AI 分身
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push("/import")}
            activeOpacity={0.7}
          >
            <Text style={styles.emptyButtonText}>导入聊天记录</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={Separator}
        />
      )}

      {/* 悬浮新建按钮（始终显示） */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleFabPress}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },

  // 顶部
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: PAGE_BG,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#191919",
  },

  // 列表
  listContent: {
    paddingBottom: 80,
  },

  // 会话项
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E5E5",
    marginLeft: 72,
  },

  // 头像 - 微信风格圆形（匹配Demo）
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: WECHAT_GREEN,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "600",
  },

  // 中间内容区
  itemCenter: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
    justifyContent: "center",
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#191919",
    marginBottom: 4,
  },
  itemPreview: {
    fontSize: 13,
    color: "#999999",
    lineHeight: 18,
  },

  // 右侧
  itemRight: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  itemTime: {
    fontSize: 12,
    color: "#B0B0B0",
    marginBottom: 4,
  },
  itemBadgePlaceholder: {
    width: 6,
    height: 6,
  },

  // 空状态
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333333",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999999",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 32,
  },
  emptyButton: {
    backgroundColor: WECHAT_GREEN,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  // 悬浮按钮
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: WECHAT_GREEN,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabIcon: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "400",
    lineHeight: 32,
  },
});
