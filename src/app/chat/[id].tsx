import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
  Alert,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { useChatStore, type UIMessage } from "../../stores/chatStore";
import { parseCorrection } from "../../modules/persona/correctionHandler";
import { addCorrection } from "../../modules/persona/personaService";


  // === 对话纠正 ===

// ========== 模块级常量 ==========
const PAGE_BG = "#F5F5F5";
const NAV_BG = "#FFFFFF";
const NAV_TEXT = "#333333";
const AVATAR_SIZE = 36;
const BUBBLE_ME = "#DCF8C5";
const BUBBLE_HER = "#FFFFFF";
const TEXT_DARK = "#1A1A1A";
const INPUT_BAR_BG = "#F7F7F7";

// ========== Emoji 列表 ==========
const EMOJI_LIST: { text: string; emoji: string }[] = [
  { text: "开心", emoji: "😊" },
  { text: "大笑", emoji: "😂" },
  { text: "笑哭", emoji: "😅" },
  { text: "爱心", emoji: "❤️" },
  { text: "飞吻", emoji: "😘" },
  { text: "可爱", emoji: "🥰" },
  { text: "调皮", emoji: "😜" },
  { text: "酷", emoji: "😎" },
  { text: "难过", emoji: "😢" },
  { text: "生气", emoji: "😤" },
  { text: "抓狂", emoji: "😫" },
  { text: "尴尬", emoji: "😅" },
  { text: "惊讶", emoji: "😱" },
  { text: "无语", emoji: "🙄" },
  { text: "OK", emoji: "👌" },
  { text: "赞", emoji: "👍" },
  { text: "抱", emoji: "🤗" },
  { text: "晚安", emoji: "🌙" },
  { text: "太阳", emoji: "☀️" },
  { text: "咖啡", emoji: "☕" },
  { text: "蛋糕", emoji: "🎂" },
  { text: "礼物", emoji: "🎁" },
  { text: "烟花", emoji: "🎉" },
  { text: "玫瑰", emoji: "🌹" },
];
const EMOJI_COLS = 6;


// ========== 头像组件 ==========
function HerAvatar() {
  return (
    <View style={styles.avatarWrap}>
      <View style={[styles.avatar, styles.avatarHer]}>
        <Text style={styles.avatarTxt}>她</Text>
      </View>
    </View>
  );
}

function MyAvatar() {
  return (
    <View style={styles.avatarWrap}>
      <View style={[styles.avatar, styles.avatarMe]}>
        <Text style={styles.avatarTxt}>我</Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  // ========== 路由 ==========
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // ========== Store ==========
  const { persona, messages, isThinking, sendMessage, loadFromConversationId, loadMessages } = useChatStore();

  // ========== 本地状态 ==========
  const [inputText, setInputText] = useState("");
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [showFuncPanel, setShowFuncPanel] = useState(false);
  const [recentEmoji, setRecentEmoji] = useState<string[]>(["开心", "大笑", "笑哭", "爱心"]);
  const flatListRef = useRef<any>(null);

  // ========== 对话纠正 ==========
  const handleCorrection = useCallback(async (msg: UIMessage) => {
    if (typeof window !== "undefined" && window.confirm) {
      if (!window.confirm("纠正TA - 她应该怎么回应？")) return;
      setCorrectingMsg(msg);
    } else {
      setCorrectingMsg(msg);
    }
  }, []);

  const [correctingMsg, setCorrectingMsg] = useState<UIMessage | null>(null);
  const [correctionInput, setCorrectionInput] = useState("");
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  const submitCorrection = useCallback(async () => {
    if (!correctingMsg || !correctionInput.trim()) return;
    setSubmittingCorrection(true);
    try {
      const parsed = await parseCorrection(persona?.name || "她", correctionInput);
      if (persona?.id) {
        await addCorrection(persona.id, {
          scene: parsed.scene || "对话中",
          wrongBehavior: parsed.wrongBehavior || "当前回复",
          correctBehavior: parsed.correctBehavior || correctionInput,
          timestamp: new Date().toISOString(),
        });
      }
      if (typeof window !== "undefined" && window.confirm) { window.alert("✅ 已记录\n" + (parsed.correctionRecord || correctionInput)); } else { Alert.alert("✅ 已记录", parsed.correctionRecord || correctionInput); }
    } catch {
      if (persona?.id) {
        await addCorrection(persona.id, {
          scene: "对话中",
          wrongBehavior: "当前回复",
          correctBehavior: correctionInput,
          timestamp: new Date().toISOString(),
        });
      }
      if (typeof window !== "undefined" && window.confirm) { window.alert("✅ 已记录\n已记录纠正：" + correctionInput); } else { Alert.alert("✅ 已记录", "已记录纠正：" + correctionInput); }
    }
    setCorrectingMsg(null);
    setCorrectionInput("");
    setSubmittingCorrection(false);
  }, [correctingMsg, correctionInput, persona]);

  // ========== 初始化 ==========
  useEffect(() => {
    if (!id) return;
    const { persona, conversationId } = useChatStore.getState();
    if (persona && conversationId === id) {
      // 已从 setup 页面初始化完成，直接加载消息
      loadMessages();
    } else {
      // 从会话列表进入，需要根据 conversationId 查询
      loadFromConversationId(id).then(() => loadMessages()).catch((e) => {
        console.warn('加载会话失败:', e.message);
      });
  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  // ========== 消息操作 ==========
  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || isThinking) return;
    sendMessage(text);
    setInputText("");
  }, [inputText, sendMessage, isThinking]);

  const insertEmoji = useCallback((emoji: string) => {
    setInputText(function(prev) { return prev + emoji; });
  }, []);

  // ========== 面板切换 ==========
  const toggleEmoji = useCallback(() => {
    setShowEmojiPanel(function(v) { return !v; });
    setShowFuncPanel(false);
    setIsVoiceMode(false);
  }, []);

  const toggleFunc = useCallback(() => {
    setShowFuncPanel(function(v) { return !v; });
    setShowEmojiPanel(false);
    setIsVoiceMode(false);
  }, []);

  const toggleVoice = useCallback(() => {
    setIsVoiceMode(function(v) { return !v; });
    setShowEmojiPanel(false);
    setShowFuncPanel(false);
  }, []);

  const closeAllPanels = useCallback(() => {
    setShowEmojiPanel(false);
    setShowFuncPanel(false);
    setIsVoiceMode(false);
  }, []);

  // ========== 附件操作 ==========
  const handlePickPhoto = useCallback(async () => {
    try {
      var result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled && result.assets.length > 0) {
        sendMessage("[图片]" + result.assets[0].uri);
      }
    } catch (e) {
      console.warn("pick photo error", e);
    }
    setShowFuncPanel(false);
  }, [sendMessage]);

  const handleTakeCamera = useCallback(async () => {
    try {
      var result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
      });
      if (!result.canceled && result.assets.length > 0) {
        sendMessage("[拍照]" + result.assets[0].uri);
      }
    } catch (e) {
      console.warn("take photo error", e);
    }
    setShowFuncPanel(false);
  }, [sendMessage]);

  const handlePickFile = useCallback(async () => {
    try {
      var result = await DocumentPicker.getDocumentAsync({});
      if (!result.canceled && result.assets.length > 0) {
        sendMessage("[文件]" + result.assets[0].name);
      }
    } catch (e) {
      console.warn("pick file error", e);
    }
    setShowFuncPanel(false);
  }, [sendMessage]);

  // ========== 语音 ==========
  const handleRecordStart = useCallback(() => {
    setRecording(true);
  }, []);

  // ========== renderHeader ==========
  const renderHeader = useMemo(function() {
    return null;
  }, []);

  // ========== renderMessage ==========
const renderMessage = ({ item, index }: { item: UIMessage; index: number }) => {
    const isMe = item.role === "user";
    const showTime = shouldShowTime(messages, index);
    return (
      <View>
        {showTime && <Text style={styles.timeStamp}>{formatMessageTime(item.createdAt)}</Text>}
        <View style={[styles.msgItem, isMe && styles.msgItemReverse]}>
          {!isMe && <HerAvatar />}
          <View style={styles.msgBody}>
            <TouchableOpacity onLongPress={() => handleCorrection(item)} disabled={isMe || !!item.isStreaming} activeOpacity={0.7}>
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleHer]}>
              <Text style={styles.bubbleText}>
                {item.text}
                {item.isStreaming && <Text style={styles.cursor}>|</Text>}
              </Text>
            </View>
            </TouchableOpacity>
            {item.stickerUri && !item.isStreaming && (
              <View style={styles.stickerWrap}>
                <Image source={{ uri: item.stickerUri }} style={styles.stickerImg} />
              </View>
            )}
          </View>
          {isMe && <MyAvatar />}
        </View>
      </View>
    );
  };

  const hasText = inputText.trim().length > 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 导航栏 */}
      
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.navBackIcon}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{persona?.name ?? "她"}</Text>
        <TouchableOpacity style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.navMenuIcon}>...</Text>
        </TouchableOpacity>
      </View>

      {/* 消息列表 */}
      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={0}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>开始和她说说话吧</Text>
            </View>
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {/* 表情面板 */}
        {showEmojiPanel && <EmojiPanel emojiList={EMOJI_LIST} recent={recentEmoji} onSelect={insertEmoji} cols={EMOJI_COLS} />}

        {/* 功能面板 */}
        {showFuncPanel && (
          <View style={styles.funcPanel}>
            <FuncItem icon="📷" label="相片" onPress={handlePickPhoto} />
            <FuncItem icon="📷" label="拍摄" onPress={handleTakeCamera} />
            <FuncItem icon="📄" label="文件" onPress={handlePickFile} />
          </View>
        )}

        {/* 输入栏 */}
        <View style={styles.inputBar}>
          {/* 语音/键盘切换 */}
          <TouchableOpacity style={styles.toolBtn} onPress={toggleVoice}>
            <Text style={styles.toolBtnIcon}>{isVoiceMode ? "♪" : "🎤"}</Text>
          </TouchableOpacity>

          {/* 语音妯″紡锛氭寜浣忚璇?*/}
          {isVoiceMode ? (
            <TouchableOpacity
              style={[styles.recordBtn, recording && styles.recordBtnActive]}
              onPressIn={handleRecordStart}
              activeOpacity={0.6}
            >
              <Text style={styles.recordBtnText}>按住 说话</Text>
            </TouchableOpacity>
          ) : (
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder=""
              placeholderTextColor="#999"
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
              onFocus={closeAllPanels}
            />
          )}

          {/* 表情按钮 */}
          <TouchableOpacity style={styles.toolBtn} onPress={toggleEmoji}>
            <Text style={styles.toolBtnIcon}>😊</Text>
          </TouchableOpacity>

          {/* + / 发送 */}
          {hasText && !isVoiceMode ? (
            <TouchableOpacity onPress={handleSend} style={styles.sendBtn} activeOpacity={0.7}>
              <Text style={styles.sendBtnText}>发送</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.toolBtn} onPress={toggleFunc}>
              <Text style={styles.toolBtnIcon}>+</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    
      {/* 纠正弹窗 */}
      {correctingMsg && (
        <View style={styles.correctionOverlay}>
          <View style={styles.correctionModal}>
            <Text style={styles.correctionTitle}>纠正她</Text>
            <Text style={styles.correctionHint}>她原来的回复：</Text>
            <Text style={styles.correctionOrigMsg}>{correctingMsg.text}</Text>
            <Text style={styles.correctionHint}>她应该怎么说？</Text>
            <TextInput style={styles.correctionInput} value={correctionInput} onChangeText={setCorrectionInput}
              placeholder="例如：她不会直接说想我，会发个表情包等我找她" multiline autoFocus />
            <View style={styles.correctionBtns}>
              <TouchableOpacity style={styles.correctionCancelBtn}
                onPress={() => { setCorrectingMsg(null); setCorrectionInput(""); }}>
                <Text style={styles.correctionCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.correctionSubmitBtn, submittingCorrection && { opacity: 0.5 }]}
                onPress={submitCorrection} disabled={submittingCorrection}>
                <Text style={styles.correctionSubmitText}>{submittingCorrection ? "处理中..." : "确认纠正"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

</SafeAreaView>
  );
}

// ========== 表情面板 ==========
function EmojiPanel({
  emojiList,
  recent,
  onSelect,
  cols,
}: {
  emojiList: { text: string; emoji: string }[];
  recent: string[];
  onSelect: (key: string) => void;
  cols: number;
}) {
  const colW = 100 / cols;
  return (
    <View style={styles.emojiPanel}>
      <ScrollView style={{ maxHeight: 220 }}>
        {/* 最近使用*/}
        {recent.length > 0 && (
          <>
            <Text style={styles.emojiSectionTitle}>最近使用</Text>
            <View style={styles.emojiGrid}>
              {recent.map((key) => {
                const e = emojiList.find((x) => x.text === key);
                return (
                  <TouchableOpacity key={key} style={[styles.emojiCell, { width: `${colW}%` }]} onPress={() => { const e = emojiList.find(x => x.text === key); if (e) onSelect(e.emoji); else onSelect(key); }}>
                    <Text style={styles.emojiChar}>{e?.emoji ?? "❤"}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
        {/* 所有表情*/}
        <Text style={styles.emojiSectionTitle}>所有表情</Text>
        <View style={styles.emojiGrid}>
          {emojiList.map((e) => (
            <TouchableOpacity key={e.text} style={[styles.emojiCell, { width: `${colW}%` }]} onPress={() => onSelect(e.emoji)}>
              <Text style={styles.emojiChar}>{e.emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      {/* 底部操作栏 */}
      <View style={styles.emojiBar}>
        <TouchableOpacity style={styles.emojiDelBtn} onPress={() => {}}>
          <Text style={{ fontSize: 18, color: "#999" }}>✓</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.emojiSendBtn}>
          <Text style={styles.emojiSendText}>发送</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ========== 功能面板按钮 ==========
function FuncItem({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.funcItem} onPress={onPress} activeOpacity={0.6}>
      <View style={styles.funcIconWrap}>
        <Text style={styles.funcIcon}>{icon}</Text>
      </View>
      <Text style={styles.funcLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ========== 打字动画 ==========
function TypingDots() {
  const dots = useMemo(() => [new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)], []);
  useEffect(() => {
    const anis = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay((2 - i) * 150),
        ]),
      ),
    );
    Animated.parallel(anis).start();
    return () => anis.forEach((a) => a.stop());
  }, [dots]);
  return (
    <View style={styles.typingWrap}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={[styles.typingDot, { transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }], opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }]} />
      ))}
    </View>
  );
}

function shouldShowTime(msgs: UIMessage[], i: number): boolean {
  if (i === 0) return true;
  return new Date(msgs[i].createdAt).getTime() - new Date(msgs[i - 1].createdAt).getTime() > 5 * 60 * 1000;
}
function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ========== Styles ==========

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },

  // 导航栏
  navBar: { height: 48, backgroundColor: NAV_BG, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E5E5" },
  navBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  navBackIcon: { color: NAV_TEXT, fontSize: 22, fontWeight: "400" },
  navTitle: { flex: 1, color: NAV_TEXT, fontSize: 17, fontWeight: "600", textAlign: "center" },
  navMenuIcon: { color: NAV_TEXT, fontSize: 18, fontWeight: "700", letterSpacing: 1 },

  // 娑堟伅
  body: { flex: 1 },
  listContent: { paddingHorizontal: 14, paddingVertical: 10 },
  timeStamp: { textAlign: "center", color: "#B0B0B0", fontSize: 12, marginVertical: 8 },
  msgItem: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8 },
  msgItemReverse: { flexDirection: "row-reverse" },
  msgBody: { maxWidth: "70%", marginHorizontal: 9 },
  avatarWrap: { flexShrink: 0 },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  avatarHer: { backgroundColor: "#FF9EAF" },
  avatarMe: { backgroundColor: "#4A90D9" },
  avatarImg: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  avatarTxt: { color: "#FFF", fontSize: 18, fontWeight: "600" },

  // 气泡
  bubble: { paddingHorizontal: 12, paddingVertical: 9 },
  bubbleMe: { backgroundColor: BUBBLE_ME, borderRadius: 16, borderTopRightRadius: 4 },
  bubbleHer: { backgroundColor: BUBBLE_HER, borderRadius: 16, borderTopLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: "#E4E4E4" },
  bubbleText: { fontSize: 16, lineHeight: 22, color: TEXT_DARK },
  cursor: { color: "#07C160", fontWeight: "300" },
  stickerWrap: { marginTop: 4 },
  stickerImg: { width: 120, height: 120, borderRadius: 8, backgroundColor: "#F0F0F0" },
  typingWrap: { flexDirection: "row", alignItems: "center", gap: 4, height: 16 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#B0B0B0" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 120 },
  emptyText: { fontSize: 15, color: "#B0B0B0" },

  // 表情面板
  emojiPanel: { backgroundColor: "#F8F8F8", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E5E5" },
  emojiSectionTitle: { fontSize: 13, color: "#888", padding: 10, paddingLeft: 14 },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 4 },
  emojiCell: { aspectRatio: 1, justifyContent: "center", alignItems: "center", padding: 2 },
  emojiChar: { fontSize: 24 },
  emojiBar: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", padding: 8, gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E5E5" },
  emojiDelBtn: { width: 44, height: 36, justifyContent: "center", alignItems: "center" },
  emojiSendBtn: { backgroundColor: "#07C160", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 4 },
  emojiSendText: { color: "#FFF", fontSize: 14, fontWeight: "600" },

  // 功能面板
  funcPanel: { flexDirection: "row", backgroundColor: "#F8F8F8", padding: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E5E5", gap: 20 },
  funcItem: { alignItems: "center", gap: 8 },
  funcIconWrap: { width: 60, height: 60, borderRadius: 12, backgroundColor: "#FFF", justifyContent: "center", alignItems: "center" },
  funcIcon: { fontSize: 28 },
  funcLabel: { fontSize: 12, color: "#666" },

  // 输入栏
  inputBar: { flexDirection: "row", alignItems: "flex-end", backgroundColor: INPUT_BAR_BG, paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E5E5", gap: 4 },
  toolBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  toolBtnIcon: { fontSize: 24 },
  textInput: { flex: 1, backgroundColor: "#FFF", borderRadius: 5, paddingHorizontal: 12, paddingVertical: Platform.OS === "ios" ? 9 : 6, fontSize: 16, lineHeight: 20, maxHeight: 100, borderWidth: 1, borderColor: "#F4F4F4", color: TEXT_DARK },
  recordBtn: { flex: 1, backgroundColor: "#FFF", borderRadius: 5, height: 38, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#F4F4F4" },
  recordBtnActive: { backgroundColor: "#E5E5E5" },
  recordBtnText: { fontSize: 15, color: "#333" },
  sendBtn: { backgroundColor: "#07C160", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 4, minWidth: 52, alignItems: "center" },
  sendBtnText: { color: "#FFF", fontSize: 15, fontWeight: "600" },
  // 纠正弹窗
  correctionOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", zIndex: 100 },
  correctionModal: { backgroundColor: "#FFF", borderRadius: 16, padding: 24, marginHorizontal: 32, width: "85%", maxWidth: 400 },
  correctionTitle: { fontSize: 18, fontWeight: "600", color: "#333", marginBottom: 12, textAlign: "center" },
  correctionHint: { fontSize: 13, color: "#888", marginTop: 8 },
  correctionOrigMsg: { fontSize: 14, color: "#666", backgroundColor: "#F5F5F5", padding: 12, borderRadius: 8, marginTop: 4, fontStyle: "italic" },
  correctionInput: { backgroundColor: "#F5F5F5", borderRadius: 8, padding: 12, fontSize: 15, marginTop: 8, minHeight: 80, textAlignVertical: "top", color: "#333" },
  correctionBtns: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 16 },
  correctionCancelBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  correctionCancelText: { fontSize: 15, color: "#888" },
  correctionSubmitBtn: { backgroundColor: "#07C160", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  correctionSubmitText: { fontSize: 15, color: "#FFF", fontWeight: "600" }
});














