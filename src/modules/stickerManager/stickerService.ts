// =============================================================================
// stickerService — 表情包服务
// 规则 1(契约优先): 通过 getStore() 统一访问存储层
// =============================================================================

import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { nanoid } from "nanoid";
import { getStore } from "../database/storeProvider";
import { keywordMatch } from "./keywordMatcher";
import type { StickerRecord, StickerSearchResult } from "./types";

const STICKERS_DIR = `${FileSystem.documentDirectory}stickers/`;

export const StickerService = {
  /** 从相册导入表情包 */
  async importSticker(label?: string): Promise<StickerRecord> {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error("相册权限被拒绝");

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 0.9,
    });

    if (result.canceled || !result.assets[0]) throw new Error("已取消");

    const asset = result.assets[0];

    const manipulated = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 512 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );

    await FileSystem.makeDirectoryAsync(STICKERS_DIR, { intermediates: true });
    await FileSystem.writeAsStringAsync(`${STICKERS_DIR}.nomedia`, "");
    const destPath = `${STICKERS_DIR}${nanoid()}.jpg`;
    await FileSystem.copyAsync({ from: manipulated.uri, to: destPath });

    const store = await getStore();
    const row = await store.insertSticker({
      filePath: destPath,
      label: label ?? asset.fileName ?? "表情包",
    });

    return {
      id: row.id,
      filePath: row.file_path,
      label: row.label,
      embedding: [],
    };
  },

  /** 获取所有表情包 */
  async getAll(): Promise<StickerRecord[]> {
    const store = await getStore();
    const rows = await store.getAllStickers();
    return rows.map((r) => ({
      id: r.id,
      filePath: r.file_path,
      label: r.label,
      embedding: r.embedding ? JSON.parse(r.embedding) : [],
    }));
  },

  /** 根据文本语义检索最优匹配 */
  async search(queryText: string, topK = 1): Promise<StickerSearchResult[]> {
    const all = await this.getAll();
    if (all.length === 0) return [];
    return keywordMatch(queryText, all, topK);
  },

  /** 删除表情包 */
  async remove(id: string): Promise<void> {
    const all = await this.getAll();
    const target = all.find((s) => s.id === id);

    if (target?.filePath) {
      try {
        await FileSystem.deleteAsync(target.filePath, { idempotent: true });
      } catch {
        // 文件不存在可忽略
      }
    }

    const store = await getStore();
    await store.deleteStickerById(id);
  },
};
