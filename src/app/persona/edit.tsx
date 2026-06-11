import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getPersonaById, updatePersonaLayers } from "../../modules/persona/personaService";
import type { Persona, PersonaLayers } from "../../modules/persona/types";

const HER_PINK = "#FF9EAF";
const BG_GRAY = "#F3F3F3";
const WECHAT_GREEN = "#07C160";

export default function PersonaEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [persona, setPersona] = useState<Persona | null>(null);

  const [layer0Rules, setLayer0Rules] = useState("");
  const [layer1Occupation, setLayer1Occupation] = useState("");
  const [layer1Mbti, setLayer1Mbti] = useState("");
  const [layer1Attachment, setLayer1Attachment] = useState("");
  const [layer1Duration, setLayer1Duration] = useState("");
  const [layer1HowMet, setLayer1HowMet] = useState("");
  const [layer1Impression, setLayer1Impression] = useState("");
  const [layer2Catchphrases, setLayer2Catchphrases] = useState("");
  const [layer2HighFreq, setLayer2HighFreq] = useState("");
  const [layer2StyleDesc, setLayer2StyleDesc] = useState("");
  const [layer2EmojiDesc, setLayer2EmojiDesc] = useState("");
  const [layer2Scenarios, setLayer2Scenarios] = useState("");
  const [layer3Priority, setLayer3Priority] = useState("");
  const [layer3Affection, setLayer3Affection] = useState("");
  const [layer3Withdrawal, setLayer3Withdrawal] = useState("");
  const [layer3Dissatisfaction, setLayer3Dissatisfaction] = useState("");
  const [layer3ResponseCriticism, setLayer3ResponseCriticism] = useState("");
  const [layer4Partner, setLayer4Partner] = useState("");
  const [layer4HisFriends, setLayer4HisFriends] = useState("");
  const [layer4HerFriends, setLayer4HerFriends] = useState("");
  const [layer4Family, setLayer4Family] = useState("");
  const [layer4Stress, setLayer4Stress] = useState("");
  const [layer5Boundaries, setLayer5Boundaries] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const p = await getPersonaById(id); if (!p) { Alert.alert('错误', '分身不存在'); router.back(); return; }
      setPersona(p);
      const layers = (p.layers || {}) as PersonaLayers;

      setLayer0Rules(layers.layer0?.rules?.join("\n") || "");
      setLayer1Occupation(layers.layer1?.occupation || "");
      setLayer1Mbti(layers.layer1?.mbti || "");
      setLayer1Attachment(layers.layer1?.attachmentType || "");
      setLayer1Duration(layers.layer1?.duration || "");
      setLayer1HowMet(layers.layer1?.howMet || "");
      setLayer1Impression(layers.layer1?.impression || "");
      setLayer2Catchphrases(layers.layer2?.catchphrases?.join("、") || "");
      setLayer2HighFreq(layers.layer2?.highFreqWords?.join("、") || "");
      setLayer2StyleDesc(layers.layer2?.styleDesc || "");
      setLayer2EmojiDesc(layers.layer2?.emojiDesc || "");
      setLayer2Scenarios(
        layers.layer2?.scenarios
          ? Object.entries(layers.layer2.scenarios).map(([k, v]) => k + "：" + v).join("\n")
          : ""
      );
      setLayer3Priority(layers.layer3?.priority || "");
      setLayer3Affection(layers.layer3?.affectionTriggers || "");
      setLayer3Withdrawal(layers.layer3?.withdrawalTriggers || "");
      setLayer3Dissatisfaction(layers.layer3?.dissatisfactionExpr || "");
      setLayer3ResponseCriticism(layers.layer3?.responseToCriticism || "");
      setLayer4Partner(layers.layer4?.withPartner || "");
      setLayer4HisFriends(layers.layer4?.withHisFriends || "");
      setLayer4HerFriends(layers.layer4?.withHerFriends || "");
      setLayer4Family(layers.layer4?.withFamily || "");
      setLayer4Stress(layers.layer4?.underStress || "");
      setLayer5Boundaries(layers.layer5?.join("\n") || "");
    } catch (e) {
      Alert.alert("错误", "加载分身失败");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSave = useCallback(async () => {
    if (!persona || !id) return;
    setSaving(true);
    try {
      const parseList = (s: string) => s.split(/[\n,、]/).map((x) => x.trim()).filter(Boolean);
      const parseScenarios = (s: string) => {
        const obj: Record<string, string> = {};
        s.split("\n").filter(Boolean).forEach((line) => {
          const idx = line.indexOf("：");
          if (idx > 0) obj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        });
        return obj;
      };

      const layers: PersonaLayers = {};
      const r0 = parseList(layer0Rules);
      if (r0.length) layers.layer0 = { rules: r0 };
      const l1: any = {};
      if (layer1Occupation) l1.occupation = layer1Occupation;
      if (layer1Mbti) l1.mbti = layer1Mbti;
      if (layer1Attachment) l1.attachmentType = layer1Attachment;
      if (layer1Duration) l1.duration = layer1Duration;
      if (layer1HowMet) l1.howMet = layer1HowMet;
      if (layer1Impression) l1.impression = layer1Impression;
      if (Object.keys(l1).length) layers.layer1 = l1;
      const l2: any = {};
      const cp = parseList(layer2Catchphrases);
      if (cp.length) l2.catchphrases = cp;
      const hf = parseList(layer2HighFreq);
      if (hf.length) l2.highFreqWords = hf;
      if (layer2StyleDesc) l2.styleDesc = layer2StyleDesc;
      if (layer2EmojiDesc) l2.emojiDesc = layer2EmojiDesc;
      const sc = parseScenarios(layer2Scenarios);
      if (Object.keys(sc).length) l2.scenarios = sc;
      if (Object.keys(l2).length) layers.layer2 = l2;
      const l3: any = {};
      if (layer3Priority) l3.priority = layer3Priority;
      if (layer3Affection) l3.affectionTriggers = layer3Affection;
      if (layer3Withdrawal) l3.withdrawalTriggers = layer3Withdrawal;
      if (layer3Dissatisfaction) l3.dissatisfactionExpr = layer3Dissatisfaction;
      if (layer3ResponseCriticism) l3.responseToCriticism = layer3ResponseCriticism;
      if (Object.keys(l3).length) layers.layer3 = l3;
      const l4: any = {};
      if (layer4Partner) l4.withPartner = layer4Partner;
      if (layer4HisFriends) l4.withHisFriends = layer4HisFriends;
      if (layer4HerFriends) l4.withHerFriends = layer4HerFriends;
      if (layer4Family) l4.withFamily = layer4Family;
      if (layer4Stress) l4.underStress = layer4Stress;
      if (Object.keys(l4).length) layers.layer4 = l4;
      const l5 = parseList(layer5Boundaries);
      if (l5.length) layers.layer5 = l5;

      await updatePersonaLayers(id, layers);
      Alert.alert("保存成功", "Persona 已更新");
      router.back();
    } catch (e: any) {
      Alert.alert("保存失败", e?.message || "未知错误");
    } finally {
      setSaving(false);
    }
  }, [/* deps */]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={HER_PINK} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
          <Text style={styles.navBack}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>编辑 Persona</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.navBtn}>
          <Text style={[styles.navSave, saving && { opacity: 0.5 }]}>{saving ? "..." : "保存"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent}>
        <EditSection title="Layer 0 · 核心规则" subtitle="每条一行，描述具体行为">
          <TextInput style={styles.textArea} value={layer0Rules} onChangeText={setLayer0Rules}
            placeholder={"生气了不会直接说，而是已读不回\n吵架时会翻旧账\n想要什么会用撒娇的方式"} multiline />
        </EditSection>

        <EditSection title="Layer 1 · 身份" subtitle="基本信息">
          <EditField label="职业" value={layer1Occupation} onChange={setLayer1Occupation} placeholder="UI 设计师" />
          <EditField label="MBTI" value={layer1Mbti} onChange={setLayer1Mbti} placeholder="ENFP" />
          <EditField label="依恋类型" value={layer1Attachment} onChange={setLayer1Attachment} placeholder="焦虑型/安全型/回避型" />
          <EditField label="在一起" value={layer1Duration} onChange={setLayer1Duration} placeholder="两年半" />
          <EditField label="认识方式" value={layer1HowMet} onChange={setLayer1HowMet} placeholder="大学同学" />
          <EditField label="印象描述" value={layer1Impression} onChange={setLayer1Impression} placeholder="嘴上说不在意，其实比谁都在意" />
        </EditSection>

        <EditSection title="Layer 2 · 表达风格" subtitle="说话方式">
          <EditField label="口头禅" value={layer2Catchphrases} onChange={setLayer2Catchphrases} placeholder="用顿号分隔：好叭、哎呀、讨厌" />
          <EditField label="高频词" value={layer2HighFreq} onChange={setLayer2HighFreq} placeholder="用顿号分隔：嘛、啦、呀" />
          <EditField label="句式特征" value={layer2StyleDesc} onChange={setLayer2StyleDesc} placeholder="短消息为主，习惯连发好几条" />
          <EditField label="Emoji 习惯" value={layer2EmojiDesc} onChange={setLayer2EmojiDesc} placeholder="重度用户：笑哭爱心可爱" />
          <Text style={styles.fieldLabel}>场景示例（每行：场景：回复）</Text>
          <TextInput style={styles.textArea} value={layer2Scenarios} onChangeText={setLayer2Scenarios}
            placeholder={"有人问想吃什么：随便啊\n有人说想你了：哼 你才想我的吗"} multiline />
        </EditSection>

        <EditSection title="Layer 3 · 情感逻辑" subtitle="情绪模式">
          <EditField label="优先级排序" value={layer3Priority} onChange={setLayer3Priority} placeholder="安全感大于被关注大于被理解" />
          <EditField label="主动表达爱" value={layer3Affection} onChange={setLayer3Affection} placeholder="什么情况下会主动说爱你" />
          <EditField label="退缩触发" value={layer3Withdrawal} onChange={setLayer3Withdrawal} placeholder="什么情况下会沉默或冷暴力" />
          <EditField label="表达不满" value={layer3Dissatisfaction} onChange={setLayer3Dissatisfaction} placeholder="已读不回、语气变冷" />
          <EditField label="面对质疑" value={layer3ResponseCriticism} onChange={setLayer3ResponseCriticism} placeholder="先委屈，然后反攻" />
        </EditSection>

        <EditSection title="Layer 4 · 关系行为" subtitle="不同关系场景">
          <EditField label="和伴侣" value={layer4Partner} onChange={setLayer4Partner} placeholder="粘人、需要早安晚安" />
          <EditField label="和对方朋友" value={layer4HisFriends} onChange={setLayer4HisFriends} placeholder="开始害羞，熟了话多" />
          <EditField label="和自己朋友" value={layer4HerFriends} onChange={setLayer4HerFriends} placeholder="和闺蜜什么都说" />
          <EditField label="和家人" value={layer4Family} onChange={setLayer4Family} placeholder="和妈妈关系亲密" />
          <EditField label="压力下" value={layer4Stress} onChange={setLayer4Stress} placeholder="需要陪伴和安慰" />
        </EditSection>

        <EditSection title="Layer 5 · 边界与雷区" subtitle="底线、雷区、回避话题（每条一行）">
          <TextInput style={styles.textArea} value={layer5Boundaries} onChangeText={setLayer5Boundaries}
            placeholder={"被忽视（消息不回、重要日子忘了）\n被否定感受\n欺骗（最不能接受说谎）"} multiline />
        </EditSection>
      </ScrollView>
    </SafeAreaView>
  );
}

function EditSection({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function EditField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.fieldInput} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#CCC" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_GRAY },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: BG_GRAY },
  navBar: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12,
    paddingVertical: 10, backgroundColor: "#FFF", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E5E5"
  },
  navBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  navBack: { fontSize: 22, color: "#333", fontWeight: "400" },
  navTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: "#333", textAlign: "center" },
  navSave: { fontSize: 16, color: WECHAT_GREEN, fontWeight: "600" },
  body: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  section: { backgroundColor: "#FFF", borderRadius: 12, marginBottom: 12, overflow: "hidden" },
  sectionHeader: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#F0F0F0" },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#191919" },
  sectionSubtitle: { fontSize: 12, color: "#999", marginTop: 2 },
  sectionBody: { paddingHorizontal: 16, paddingVertical: 8 },
  fieldRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#F5F5F5" },
  fieldLabel: { fontSize: 13, fontWeight: "500", color: "#666", width: 80, flexShrink: 0 },
  fieldInput: { flex: 1, fontSize: 14, color: "#333", paddingVertical: 4, paddingHorizontal: 8, backgroundColor: "#FAFAFA", borderRadius: 6 },
  textArea: {
    backgroundColor: "#FAFAFA", borderRadius: 8, padding: 12, fontSize: 14, color: "#333",
    minHeight: 100, textAlignVertical: "top", lineHeight: 20,
  },
});
