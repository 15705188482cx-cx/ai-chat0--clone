import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getPersonaById } from "../../modules/persona/personaService";
import type { Persona, PersonaLayers, PersonaCorrection } from "../../modules/persona/types";

const HER_PINK = "#FF9EAF";
const BG_GRAY = "#F3F3F3";
const WECHAT_GREEN = "#07C160";

type TabKey = "layers" | "memories" | "corrections";

export default function PersonaDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("layers");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const p = await getPersonaById(id);
      setPersona(p);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={HER_PINK} />
      </SafeAreaView>
    );
  }

  if (!persona) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>分身不存在</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>返回</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const layers = (persona.layers || {}) as PersonaLayers;

  const tabs: { key: TabKey; label: string }[] = [
    { key: "layers", label: "Persona" },
    { key: "memories", label: "记忆" },
    { key: "corrections", label: "纠正" },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 导航栏 */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
          <Text style={styles.navBack}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{persona.name}</Text>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/persona/edit", params: { id: persona.id } })}
          style={styles.navBtn}
        >
          <Text style={styles.navEdit}>编辑</Text>
        </TouchableOpacity>
      </View>

      {/* 标签栏 */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 内容 */}
      <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent}>
        {activeTab === "layers" && <LayersView layers={layers} name={persona.name} />}
        {activeTab === "memories" && <MemoriesView memories={persona.layers?.layer5 ? persona.layers.layer5 : []} />}
        {activeTab === "corrections" && <CorrectionsView corrections={persona.corrections || []} />}
      </ScrollView>
    </SafeAreaView>
  );
}

// ========== Layer 组件 ==========
function LayerSection({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <View style={styles.layerCard}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.layerHeader}>
        <View style={styles.layerHeaderLeft}>
          <Text style={styles.layerTitle}>{title}</Text>
          <Text style={styles.layerSubtitle}>{subtitle}</Text>
        </View>
        <Text style={styles.expandIcon}>{expanded ? "▼" : "▶"}</Text>
      </TouchableOpacity>
      {expanded && <View style={styles.layerBody}>{children}</View>}
    </View>
  );
}

function LayersView({ layers, name }: { layers: PersonaLayers; name: string }) {
  return (
    <View>
      {/* Layer 0 */}
      <LayerSection title="Layer 0 · 核心性格" subtitle="最高优先级行为规则">
        {layers.layer0?.rules?.length ? (
          layers.layer0.rules.map((r, i) => <Text key={i} style={styles.ruleText}>• {r}</Text>)
        ) : (
          <Text style={styles.emptyHint}>暂无核心规则</Text>
        )}
      </LayerSection>

      {/* Layer 1 */}
      <LayerSection title="Layer 1 · 身份" subtitle="基本信息">
        {layers.layer1 ? (
          <View>
            {layers.layer1.occupation && <InfoRow label="职业" value={layers.layer1.occupation} />}
            {layers.layer1.mbti && <InfoRow label="MBTI" value={layers.layer1.mbti} />}
            {layers.layer1.attachmentType && <InfoRow label="依恋类型" value={layers.layer1.attachmentType} />}
            {layers.layer1.howMet && <InfoRow label="认识方式" value={layers.layer1.howMet} />}
            {layers.layer1.duration && <InfoRow label="在一起" value={layers.layer1.duration} />}
            {layers.layer1.impression && <InfoRow label="印象" value={layers.layer1.impression} />}
          </View>
        ) : (
          <Text style={styles.emptyHint}>暂无身份信息</Text>
        )}
      </LayerSection>

      {/* Layer 2 */}
      <LayerSection title="Layer 2 · 表达风格" subtitle="说话方式与习惯">
        {layers.layer2 ? (
          <View>
            {layers.layer2.catchphrases?.length > 0 && (
              <View style={styles.tagSection}>
                <Text style={styles.tagLabel}>口头禅</Text>
                <View style={styles.tagRow}>
                  {layers.layer2.catchphrases.map((p, i) => (
                    <View key={i} style={styles.tag}><Text style={styles.tagText}>{p}</Text></View>
                  ))}
                </View>
              </View>
            )}
            {layers.layer2.highFreqWords?.length > 0 && (
              <View style={styles.tagSection}>
                <Text style={styles.tagLabel}>高频词</Text>
                <View style={styles.tagRow}>
                  {layers.layer2.highFreqWords.map((w, i) => (
                    <View key={i} style={[styles.tag, { backgroundColor: "#FFF0F3" }]}>
                      <Text style={styles.tagText}>{w}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {layers.layer2.styleDesc && <InfoRow label="句式特征" value={layers.layer2.styleDesc} />}
            {layers.layer2.emojiDesc && <InfoRow label="Emoji 习惯" value={layers.layer2.emojiDesc} />}
            {layers.layer2.scenarios && Object.keys(layers.layer2.scenarios).length > 0 && (
              <View style={styles.scenarioSection}>
                <Text style={styles.tagLabel}>场景示例</Text>
                {Object.entries(layers.layer2.scenarios).map(([scene, reply], i) => (
                  <View key={i} style={styles.scenarioCard}>
                    <Text style={styles.sceneLabel}>{scene}</Text>
                    <Text style={styles.sceneReply}>{reply}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.emptyHint}>暂无风格数据</Text>
        )}
      </LayerSection>

      {/* Layer 3 */}
      <LayerSection title="Layer 3 · 情感逻辑" subtitle="情感模式与反应">
        {layers.layer3 ? (
          <View>
            {layers.layer3.priority && <InfoRow label="优先级" value={layers.layer3.priority} />}
            {layers.layer3.affectionTriggers && <InfoRow label="主动表达爱" value={layers.layer3.affectionTriggers} />}
            {layers.layer3.withdrawalTriggers && <InfoRow label="退缩触发" value={layers.layer3.withdrawalTriggers} />}
            {layers.layer3.dissatisfactionExpr && <InfoRow label="表达不满" value={layers.layer3.dissatisfactionExpr} />}
            {layers.layer3.responseToCriticism && <InfoRow label="面对质疑" value={layers.layer3.responseToCriticism} />}
          </View>
        ) : (
          <Text style={styles.emptyHint}>暂无情感数据</Text>
        )}
      </LayerSection>

      {/* Layer 4 */}
      <LayerSection title="Layer 4 · 关系行为" subtitle="不同场景下的行为">
        {layers.layer4 ? (
          <View>
            {layers.layer4.withPartner && <InfoRow label="和伴侣" value={layers.layer4.withPartner} />}
            {layers.layer4.withHisFriends && <InfoRow label="和对方朋友" value={layers.layer4.withHisFriends} />}
            {layers.layer4.withHerFriends && <InfoRow label="和自己朋友" value={layers.layer4.withHerFriends} />}
            {layers.layer4.withFamily && <InfoRow label="和家人" value={layers.layer4.withFamily} />}
            {layers.layer4.underStress && <InfoRow label="压力下" value={layers.layer4.underStress} />}
          </View>
        ) : (
          <Text style={styles.emptyHint}>暂无关系数据</Text>
        )}
      </LayerSection>

      {/* Layer 5 */}
      <LayerSection title="Layer 5 · 边界与雷区" subtitle="底线、雷区、回避话题">
        {layers.layer5?.length ? (
          layers.layer5.map((b, i) => <Text key={i} style={styles.boundaryText}>🚫 {b}</Text>)
        ) : (
          <Text style={styles.emptyHint}>暂无边界数据</Text>
        )}
      </LayerSection>
    </View>
  );
}

// ========== 记忆视图 ==========
function MemoriesView({ memories }: { memories: string[] }) {
  return (
    <View style={styles.memoriesCard}>
      <Text style={styles.memoriesTitle}>共同记忆</Text>
      {memories.length > 0 ? (
        memories.map((m, i) => <Text key={i} style={styles.memoriesItem}>• {m}</Text>)
      ) : (
        <Text style={styles.emptyHint}>
          暂无记忆数据。导入聊天记录并重新分析后，这里会显示你们的共同记忆。
        </Text>
      )}
    </View>
  );
}

// ========== 纠正记录 ==========
function CorrectionsView({ corrections }: { corrections: PersonaCorrection[] }) {
  return (
    <View style={styles.memoriesCard}>
      <Text style={styles.memoriesTitle}>对话纠正记录</Text>
      {corrections.length > 0 ? (
        corrections.map((c, i) => (
          <View key={i} style={styles.correctionItem}>
            <Text style={styles.correctionScene}>场景：{c.scene}</Text>
            <View style={styles.correctionRow}>
              <Text style={styles.wrongLabel}>不应：</Text>
              <Text style={styles.wrongText}>{c.wrongBehavior}</Text>
            </View>
            <View style={styles.correctionRow}>
              <Text style={styles.correctLabel}>应为：</Text>
              <Text style={styles.correctText}>{c.correctBehavior}</Text>
            </View>
            <Text style={styles.correctionTime}>{new Date(c.timestamp).toLocaleString("zh-CN")}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.emptyHint}>
          暂无纠正记录。在对话中长按 AI 消息即可纠正。
        </Text>
      )}
    </View>
  );
}

// ========== 小工具 ==========
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ========== Styles ==========
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_GRAY },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: BG_GRAY },
  errorText: { fontSize: 16, color: "#999", marginBottom: 16 },
  backBtn: { padding: 12 },
  backBtnText: { fontSize: 16, color: WECHAT_GREEN, fontWeight: "600" },

  // 导航栏
  navBar: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12,
    paddingVertical: 10, backgroundColor: "#FFF", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E5E5"
  },
  navBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  navBack: { fontSize: 22, color: "#333", fontWeight: "400" },
  navTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: "#333", textAlign: "center" },
  navEdit: { fontSize: 16, color: WECHAT_GREEN, fontWeight: "500" },

  // 标签栏
  tabBar: {
    flexDirection: "row", backgroundColor: "#FFF",
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E5E5",
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: HER_PINK },
  tabText: { fontSize: 15, color: "#999", fontWeight: "500" },
  tabTextActive: { color: HER_PINK, fontWeight: "600" },

  // 内容区
  body: { flex: 1 },
  scrollContent: { paddingVertical: 12, paddingHorizontal: 16, paddingBottom: 40 },

  // Layer 卡片
  layerCard: {
    backgroundColor: "#FFF", borderRadius: 12, marginBottom: 10, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  layerHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  layerHeaderLeft: { flex: 1 },
  layerTitle: { fontSize: 16, fontWeight: "600", color: "#191919" },
  layerSubtitle: { fontSize: 12, color: "#999", marginTop: 2 },
  expandIcon: { fontSize: 12, color: "#CCC", marginLeft: 8 },
  layerBody: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#F0F0F0", padding: 16, paddingTop: 12 },

  // 规则文本
  ruleText: { fontSize: 14, color: "#333", lineHeight: 22, marginBottom: 6 },
  boundaryText: { fontSize: 14, color: "#333", lineHeight: 22, marginBottom: 6 },

  // 标签
  tagSection: { marginBottom: 12 },
  tagLabel: { fontSize: 13, fontWeight: "600", color: "#666", marginBottom: 6 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { backgroundColor: "#F0F0F0", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagText: { fontSize: 13, color: "#333" },

  // 场景
  scenarioSection: { marginTop: 8 },
  scenarioCard: {
    backgroundColor: "#F9F9F9", borderRadius: 8, padding: 12, marginTop: 8,
    borderLeftWidth: 3, borderLeftColor: HER_PINK,
  },
  sceneLabel: { fontSize: 13, fontWeight: "600", color: "#666", marginBottom: 4 },
  sceneReply: { fontSize: 14, color: "#333", lineHeight: 20, fontStyle: "italic" },

  // 信息行
  infoRow: { marginBottom: 10 },
  infoLabel: { fontSize: 12, fontWeight: "600", color: "#999", marginBottom: 2 },
  infoValue: { fontSize: 14, color: "#333", lineHeight: 20 },

  // 记忆卡片
  memoriesCard: { backgroundColor: "#FFF", borderRadius: 12, padding: 16 },
  memoriesTitle: { fontSize: 16, fontWeight: "600", color: "#191919", marginBottom: 12 },
  memoriesItem: { fontSize: 14, color: "#333", lineHeight: 22, marginBottom: 4 },

  // 纠正
  correctionItem: {
    backgroundColor: "#F9F9F9", borderRadius: 8, padding: 12, marginBottom: 10,
    borderLeftWidth: 3, borderLeftColor: "#FF9500",
  },
  correctionScene: { fontSize: 13, fontWeight: "600", color: "#666", marginBottom: 6 },
  correctionRow: { flexDirection: "row", marginBottom: 2 },
  wrongLabel: { fontSize: 13, color: "#E74C3C", fontWeight: "500", width: 40 },
  wrongText: { fontSize: 13, color: "#999", flex: 1, textDecorationLine: "line-through" },
  correctLabel: { fontSize: 13, color: WECHAT_GREEN, fontWeight: "500", width: 40 },
  correctText: { fontSize: 13, color: "#333", flex: 1 },
  correctionTime: { fontSize: 11, color: "#CCC", marginTop: 4, textAlign: "right" },

  // 空状态
  emptyHint: { fontSize: 14, color: "#B0B0B0", fontStyle: "italic", lineHeight: 20 },
});
