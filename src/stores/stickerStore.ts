import { create } from "zustand";
import type { StickerRecord } from "../modules/stickerManager/types";

interface StickerState {
  stickers: StickerRecord[];
  addSticker: (sticker: StickerRecord) => void;
  removeSticker: (id: string) => void;
  setStickers: (stickers: StickerRecord[]) => void;
}

export const useStickerStore = create<StickerState>((set) => ({
  stickers: [],
  addSticker: (sticker) =>
    set((state) => ({ stickers: [...state.stickers, sticker] })),
  removeSticker: (id) =>
    set((state) => ({ stickers: state.stickers.filter((s) => s.id !== id) })),
  setStickers: (stickers) => set({ stickers }),
}));
