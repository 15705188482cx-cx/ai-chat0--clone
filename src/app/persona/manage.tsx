import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { getAllPersonas, deletePersona } from "../../modules/persona/personaService";
import type { Persona } from "../../modules/persona/types";

const WECHAT_GREEN = "#07C160";
const PAGE_BG = "#F3F3F3";

interface PersonaProfile {
  persona: Persona;
  avatarUri: string | null;
  signature: string;
}

export default function PersonaManageScreen() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<PersonaProfile[]>([]);

  const load = useCallback(async () => {
    const personas = await getAllPersonas();
    const list: PersonaProfile[] = [];
    for (const p of personas) {
      const avatar = await SecureStore.getItemAsync(`persona_avatar_${p.id}`);
      const sig = await SecureStore.getItemAsync(`persona_signature_${p.id}`);
      list.push({ persona: p, avatarUri: avatar, signature: sig || "" });
    }
    setProfiles(list);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handlePickAvatar = useCallback(async (personaId: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("权限不足"); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!r.canceled && r.assets[0]) {
      const uri = r.assets[0].uri;
      await SecureStore.setItemAsync(`persona_avatar_${personaId}`, uri);
      setProfiles((prev) => prev.map((p) => (p.persona.id === personaId ? { ...p, avatarUri: uri } : p)));
    }
  }, []);

  const handleEditSignature = useCallback((personaId: string) => {
    const profile = profiles.find((p) => p.persona.id === personaId);
    Alert.alert("提示", "请在分身创建页面修改签名");
  }, [profiles]);

  const handleDelete = useCallback((id: string, name: string) => {
    Alert.alert("删除分身", `确认删除「${name}」？删除后相关对话也会被删除。`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: async () => {
        await deletePersona(id);
        await SecureStore.deleteItemAsync(`persona_avatar_${id}`);
        await SecureStore.deleteItemAsync(`persona_signature_${id}`);
        load();
      }},
    ]);
  }, [load]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 导航栏 */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
          <Text style={styles.navBack}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>她的分身</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {profiles.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>👤</Text>
            <Text style={styles.emptyText}>还没有创建分身</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/persona/setup")}>
              <Text style={styles.emptyBtnText}>去创建</Text>
            </TouchableOpacity>
          </View>
        ) : (
          profiles.map((profile) => (
            <View key={profile.persona.id} style={styles.card}>
              {/* 分身基础信息 */}
              <View style={styles.cardHeader}>
                <TouchableOpacity style={styles.avatarWrap} onPress={() => handlePickAvatar(profile.persona.id)}>
                  <View style={styles.avatar}>
                    {profile.avatarUri ? (
                      <Image source={{ uri: profile.avatarUri }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.avatarTxt}>{profile.persona.name[0]}</Text>
                    )}
                  </View>
                  <Text style={styles.avatarHint}>点击更换</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cardInfo} onPress={() => router.push({ pathname: "/persona/detail", params: { id: profile.persona.id } })}>
                  <Text style={styles.cardName}>{profile.persona.name}</Text>
                  <Text style={styles.cardSource}>模仿对象：{profile.persona.sourceSender}</Text>
                  <Text style={styles.cardDate}>创建于 {profile.persona.createdAt.slice(0, 10)}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push({ pathname: "/persona/edit", params: { id: profile.persona.id } })} style={styles.editBtn}>
                  <Text style={styles.editBtnText}>编辑</Text>
                </TouchableOpacity>
              </View>

              {/* 签名 */}
              <TouchableOpacity style={styles.sigRow} onPress={() => handleEditSignature(profile.persona.id)}>
                <Text style={styles.sigLabel}>个性签名</Text>
                <Text style={styles.sigValue} numberOfLines={2}>{profile.signature || "未设置"}</Text>
                <Text style={styles.sigArrow}>{'>'}</Text>
              </TouchableOpacity>

              {/* 添加聊天记录 */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.actionCardItem}
                  onPress={() => router.push({ pathname: "/persona/detail", params: { id: profile.persona.id } })}
                >
                  <Text style={styles.actionCardIcon}>📋</Text>
                  <Text style={styles.actionCardText}>Persona</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionCardItem}
                  onPress={() => router.push({ pathname: "/chat/" + profile.persona.id })}
                >
                  <Text style={styles.actionCardIcon}>💬</Text>
                  <Text style={styles.actionCardText}>聊天</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionCardItem}
                  onPress={() => router.push("/import")}
                >
                  <Text style={styles.actionCardIcon}>📂</Text>
                  <Text style={styles.actionCardText}>导入</Text>
                </TouchableOpacity>
              </View>

              {/* 删除 */}
              <TouchableOpacity style={styles.delBtn} onPress={() => handleDelete(profile.persona.id, profile.persona.name)}>
                <Text style={styles.delText}>删除分身</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* 新建入口 */}
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/persona/setup")}>
          <Text style={styles.addIcon}>+</Text>
          <Text style={styles.addText}>创建新的分身</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  navBar: { height: 48, backgroundColor: "#FFF", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E5E5" },
  navBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  navBack: { color: "#000", fontSize: 22, fontWeight: "400" },
  navTitle: { flex: 1, color: "#000", fontSize: 17, fontWeight: "600", textAlign: "center" },
  content: { padding: 16, paddingBottom: 40 },

  // 卡片
  card: { backgroundColor: "#FFF", borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  avatarWrap: { alignItems: "center", marginRight: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#FF9EAF", justifyContent: "center", alignItems: "center", overflow: "hidden" },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  avatarTxt: { color: "#FFF", fontSize: 22, fontWeight: "600" },
  avatarHint: { fontSize: 10, color: "#B0B0B0", marginTop: 2 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 18, fontWeight: "600", color: "#191919", marginBottom: 2 },
  cardSource: { fontSize: 13, color: "#888", marginBottom: 2 },
  cardDate: { fontSize: 12, color: "#BBB" },

  // 签名
  sigRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#EEE" },
  sigLabel: { fontSize: 14, color: "#999", marginRight: 8 },
  sigValue: { flex: 1, fontSize: 14, color: "#333", textAlign: "right" },
  sigArrow: { fontSize: 14, color: "#CCC", marginLeft: 8 },

  // 添加记录按钮
  actionRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 10, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#EEE" },
  actionCardItem: { alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 },
  actionCardIcon: { fontSize: 20, marginBottom: 4 },
  actionCardText: { fontSize: 12, color: "#666", fontWeight: "500" },

  addRecordsBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    backgroundColor: "#F9FDF9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0F0E0",
  },
  addRecordsIcon: { fontSize: 18, marginRight: 8 },
  addRecordsText: { fontSize: 14, fontWeight: "500", color: WECHAT_GREEN, marginRight: 8 },
  addRecordsHint: { flex: 1, fontSize: 11, color: "#999", textAlign: "right" },

  
  editBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: "#FFF0F3" },
  editBtnText: { fontSize: 13, color: "#FF9EAF", fontWeight: "500" },

  // 删除
  delBtn: { alignSelf: "flex-end", paddingVertical: 4, paddingHorizontal: 8, marginTop: 4 },
  delText: { fontSize: 13, color: "#E74C3C" },

  // 新建
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#FFF", borderRadius: 12, padding: 16, gap: 8, borderWidth: 1, borderColor: "#E5E5E5", borderStyle: "dashed" },
  addIcon: { fontSize: 22, color: WECHAT_GREEN },
  addText: { fontSize: 16, color: WECHAT_GREEN, fontWeight: "500" },

  // 空
  empty: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyText: { fontSize: 16, color: "#999", marginBottom: 20 },
  emptyBtn: { backgroundColor: WECHAT_GREEN, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8 },
  emptyBtnText: { color: "#FFF", fontSize: 15, fontWeight: "600" },
});
