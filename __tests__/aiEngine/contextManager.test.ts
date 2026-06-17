import {
  trimHistory,
  trimFewShotSamples,
  estimateTokenCount,
} from "../../src/modules/aiEngine/contextManager";

describe("contextManager", () => {
  describe("trimHistory", () => {
    it("保留最近 N 轮对话", () => {
      const history: Array<{ role: "user" | "persona"; text: string }> = Array.from({ length: 50 }, (_, i) => ({
        role: (i % 2 === 0 ? "user" : "persona") as "user" | "persona",
        text: `消息${i}`,
      }));
      const trimmed = trimHistory(history, 5);
      // 5 轮 = 10 条消息
      expect(trimmed).toHaveLength(10);
      // 是最新的
      expect(trimmed[0].text).toBe("消息40");
      expect(trimmed[9].text).toBe("消息49");
    });

    it("历史不足时不报错", () => {
      const history = [
        { role: "user" as const, text: "一条" },
      ];
      const trimmed = trimHistory(history, 20);
      expect(trimmed).toHaveLength(1);
    });
  });

  describe("trimFewShotSamples", () => {
    it("在字符限制内裁剪样本", () => {
      const samples = ["短消息", "中".repeat(500), "长".repeat(2000)];
      const result = trimFewShotSamples(samples, 100);
      expect(result.length).toBeLessThanOrEqual(110); // 加上换行
      expect(result).toContain("短消息");
    });

    it("空数组返回空字符串", () => {
      expect(trimFewShotSamples([])).toBe("");
    });
  });

  describe("estimateTokenCount", () => {
    it("估算纯中文 token 数", () => {
      const count = estimateTokenCount("你好世界");
      // 4个中文 / 1.5 ≈ 3
      expect(count).toBeGreaterThanOrEqual(2);
      expect(count).toBeLessThanOrEqual(5);
    });

    it("估算纯英文 token 数", () => {
      const count = estimateTokenCount("Hello world");
      // 11字符 / 4 ≈ 3
      expect(count).toBeGreaterThanOrEqual(2);
      expect(count).toBeLessThanOrEqual(5);
    });
  });
});
