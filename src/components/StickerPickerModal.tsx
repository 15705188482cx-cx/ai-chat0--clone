import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
} from "react-native";
import { StickerService } from "../modules/stickerManager/stickerService";
import type { StickerRecord } from "../modules/stickerManager/types";

interface StickerPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (sticker: StickerRecord) => void;
}

export function StickerPickerModal({ visible, onClose, onSelect }: StickerPickerModalProps) {
  const [stickers, setStickers] = useState<StickerRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const loadStickers = async () => {
    setLoading(true);
    try {
      const all = await StickerService.getAll();
      setStickers(all);
    } catch {
      // 静默失败
    } finally {
      setLoading(false);
    }
  };

  const handleShow = () => {
    if (stickers.length === 0) loadStickers();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onShow={handleShow}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* 头部 */}
          <View style={styles.header}>
            <Text style={styles.title}>选择表情包</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 导入按钮 */}
          <TouchableOpacity
            style={styles.importButton}
            onPress={async () => {
              try {
                await StickerService.importSticker();
                await loadStickers();
              } catch {
                // 用户取消或其他错误
              }
            }}
          >
            <Text style={styles.importText}>+ 从相册导入</Text>
          </TouchableOpacity>

          {/* 表情包网格 */}
          {loading ? (
            <ActivityIndicator size="large" color="#07C160" style={styles.loader} />
          ) : stickers.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>暂无表情包</Text>
              <Text style={styles.emptyHint}>点击上方按钮从相册导入</Text>
            </View>
          ) : (
            <FlatList
              data={stickers}
              numColumns={4}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.grid}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.stickerItem}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                >
                  <Image source={{ uri: item.filePath }} style={styles.stickerImage} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "60%",
    minHeight: 300,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E0E0E0",
  },
  title: { fontSize: 16, fontWeight: "600", color: "#333" },
  close: { fontSize: 20, color: "#999", padding: 4 },
  importButton: {
    margin: 16,
    padding: 12,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderStyle: "dashed",
  },
  importText: { fontSize: 14, color: "#07C160" },
  loader: { marginVertical: 40 },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 16, color: "#999" },
  emptyHint: { fontSize: 13, color: "#CCC", marginTop: 8 },
  grid: { paddingHorizontal: 12, paddingBottom: 20 },
  stickerItem: {
    flex: 1,
    margin: 4,
    aspectRatio: 1,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    overflow: "hidden",
  },
  stickerImage: { width: "100%", height: "100%", resizeMode: "cover" },
});
