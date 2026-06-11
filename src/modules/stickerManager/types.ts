export interface StickerRecord {
  id: string;
  filePath: string;
  label: string;
  embedding: number[];
}

export interface StickerSearchResult {
  id: string;
  filePath: string;
  label: string;
  score: number;
}
