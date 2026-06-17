import { cosineSimilarity } from "../../src/modules/stickerManager/similarity";
import { keywordMatch } from "../../src/modules/stickerManager/keywordMatcher";
import type { StickerRecord } from "../../src/modules/stickerManager/types";

const mockStickers: StickerRecord[] = [
  { id: "1", filePath: "/s/happy.jpg", label: "开心 笑脸", embedding: [] },
  { id: "2", filePath: "/s/sad.jpg", label: "难过 哭泣", embedding: [] },
  { id: "3", filePath: "/s/food.jpg", label: "火锅 美食", embedding: [] },
  { id: "4", filePath: "/s/angry.jpg", label: "生气 愤怒", embedding: [] },
  { id: "5", filePath: "/s/laugh.jpg", label: "哈哈 大笑 开心", embedding: [] },
];

describe("cosineSimilarity", () => {
  it("相同向量相似度为 1", () => {
    const vec = new Float32Array([1, 0, 0]);
    const result = cosineSimilarity(vec, vec);
    expect(result).toBeCloseTo(1.0, 5);
  });

  it("正交向量相似度为 0", () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([0, 1]);
    const result = cosineSimilarity(a, b);
    expect(result).toBeCloseTo(0.0, 5);
  });

  it("零向量返回 0", () => {
    const a = new Float32Array([0, 0, 0]);
    const b = new Float32Array([1, 2, 3]);
    const result = cosineSimilarity(a, b);
    expect(result).toBe(0);
  });

  it("负值向量正确计算", () => {
    const a = new Float32Array([1, -1]);
    const b = new Float32Array([-1, 1]);
    const result = cosineSimilarity(a, b);
    expect(result).toBeCloseTo(-1.0, 5);
  });
});

describe("keywordMatch", () => {
  it("精确匹配标签返回最高分", () => {
    const results = keywordMatch("开心", mockStickers);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].label).toContain("开心");
  });

  it("多关键词匹配返回最佳结果", () => {
    const results = keywordMatch("哈哈 开心", mockStickers, 2);
    expect(results.length).toBeGreaterThan(0);
    // "哈哈 大笑 开心" 匹配两个关键词，分数应最高
    expect(results[0].id).toBe("5");
  });

  it("无匹配关键词返回空数组", () => {
    const results = keywordMatch("旅游 风景", mockStickers);
    expect(results).toHaveLength(0);
  });

  it("topK 限制返回数量", () => {
    const results = keywordMatch("开心", mockStickers, 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it("空查询返回空数组", () => {
    const results = keywordMatch("", mockStickers);
    expect(results).toHaveLength(0);
  });

  it("空表情包列表返回空数组", () => {
    const results = keywordMatch("开心", []);
    expect(results).toHaveLength(0);
  });
});
