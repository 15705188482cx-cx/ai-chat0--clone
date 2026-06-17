// ============================================================================
// Memories + Persona integration tests (mocked AI)
// ============================================================================

// Mock before any imports
jest.mock("../../src/modules/aiEngine/deepseekService", () => ({
  chatNonStreaming: jest.fn(),
  chatStreaming: jest.fn(),
}));

import { createEmptyMemories, analyzeMemories } from "../../src/modules/persona/memoriesAnalyzer";
import { formatMemories, summarizeMemories } from "../../src/modules/persona/memoriesBuilder";
import { mergeMemoriesLocal } from "../../src/modules/persona/merger";
import { createSnapshot, rollbackToVersion } from "../../src/modules/persona/versionManager";
import type { Persona, Memories } from "../../src/modules/persona";

const { chatNonStreaming } = require("../../src/modules/aiEngine/deepseekService");

const MOCK_AI_JSON = {
  timeline: [
    { date: "2023-06-15", description: "first met at university", category: "milestone" },
    { date: "2023-12-25", description: "first Christmas together", category: "milestone" },
  ],
  dailyRituals: [
    { name: "morning sticker", description: "she sends a sticker every morning", frequency: "daily" },
  ],
  preferences: [
    { category: "food", detail: "loves hotpot, hates cilantro", confidence: "high" },
  ],
  emotionalPatterns: [
    { trigger: "slow reply", herReaction: "cold replies", yourTypicalResponse: "apologize", outcome: "forgives after 30min" },
  ],
  conflictPatterns: [
    { topic: "weekend plans", howItStarts: "disagree", howItEscalates: "she withdraws", howItResolves: "compromise" },
  ],
  keyPhrases: ["whatever", "hmph", "miss you"],
  rawSummary: "Met at university. She loves hotpot. Daily morning stickers. Gets upset with slow replies.",
};

const SAMPLE_CHATS = [
  "2023-06-15 10:00:00 she: hi nice to meet you!",
  "2023-12-25 20:00:00 she: Merry Christmas!",
  "2024-03-01 08:00:00 she: morning! [sticker]",
  "2024-03-15 12:00:00 she: lets eat hotpot today",
  "2024-04-01 09:30:00 she: whatever",
];

describe("Memories AI Pipeline (mocked)", () => {
  beforeEach(() => {
    chatNonStreaming.mockReset();
    chatNonStreaming.mockResolvedValue(JSON.stringify(MOCK_AI_JSON));
  });

  it("analyzeMemories returns structured data from AI", async () => {
    const result = await analyzeMemories(SAMPLE_CHATS, "together 1 year");
    expect(result.meta.version).toBe(1);
    expect(result.meta.sourceCount).toBe(5);
    expect(result.timeline).toHaveLength(2);
    expect(result.dailyRituals).toHaveLength(1);
    expect(result.preferences).toHaveLength(1);
    expect(result.emotionalPatterns).toHaveLength(1);
    expect(result.conflictPatterns).toHaveLength(1);
    expect(result.keyPhrases).toHaveLength(3);
    expect(result.rawSummary.length).toBeGreaterThan(0);
  });

  it("empty samples return empty memories without calling AI", async () => {
    chatNonStreaming.mockResolvedValue("SHOULD NOT BE CALLED");
    const result = await analyzeMemories([], "");
    expect(result.meta.sourceCount).toBe(0);
    expect(chatNonStreaming).not.toHaveBeenCalled();
  });

  it("full pipeline: analyze -> format -> merge -> snapshot -> rollback", async () => {
    const mem = await analyzeMemories(SAMPLE_CHATS, "");
    expect(formatMemories(mem)).toContain("first met");
    expect(summarizeMemories(mem)).toContain("2");

    const merged = mergeMemoriesLocal(mem, await analyzeMemories(SAMPLE_CHATS.slice(0, 2), ""));
    expect(merged.meta.version).toBe(2);

    const persona: Persona = { id: "pipe-2", name: "T", sourceSender: "s", chatSampleIds: [], styleSummary: "", createdAt: new Date().toISOString() };

    // Snapshot initial state (version 1 from first analysis)
    createSnapshot(persona, mem, "initial analysis");

    // Snapshot after merge (version 2)
    createSnapshot(persona, merged, "after merge");

    // Rollback to version 1
    const rolled = rollbackToVersion("pipe-2", 1);
    expect(rolled).not.toBeNull();
    expect(rolled!.memories.meta.version).toBe(1);
    expect(rolled!.memories.timeline[0].description).toBe("first met at university");
  });

  it("AI failure falls back to empty memories", async () => {
    chatNonStreaming.mockRejectedValueOnce(new Error("API down"));
    const result = await analyzeMemories(["some data"], "");
    expect(result.timeline).toHaveLength(0);
  });

  it("malformed JSON returns empty memories", async () => {
    chatNonStreaming.mockResolvedValueOnce("not valid {{{ json");
    const result = await analyzeMemories(["some data"], "");
    expect(result.timeline).toHaveLength(0);
  });
});

describe("Memories data integrity", () => {
  it("version snapshot preserves and restores data exactly", () => {
    const persona: Persona = { id: "int-1", name: "T", sourceSender: "s", chatSampleIds: [], styleSummary: "", createdAt: "2024-01-01" };
    const orig: Memories = {
      meta: { version: 1, createdAt: "t", updatedAt: "t", sourceCount: 10 },
      timeline: [{ description: "original", category: "milestone" }],
      dailyRituals: [{ name: "orig", description: "d", frequency: "daily" }],
      preferences: [{ category: "f", detail: "orig", confidence: "high" }],
      emotionalPatterns: [{ trigger: "t", herReaction: "r", yourTypicalResponse: "p", outcome: "o" }],
      conflictPatterns: [{ topic: "t", howItStarts: "s", howItEscalates: "e", howItResolves: "r" }],
      keyPhrases: ["orig"],
      rawSummary: "orig summary",
    };
    createSnapshot(persona, orig, "v1");
    const mod = JSON.parse(JSON.stringify(orig));
    mod.meta.version = 2;
    mod.timeline.push({ description: "new", category: "daily" });
    mod.keyPhrases.push("new");
    createSnapshot(persona, mod, "v2");

    const rolled = rollbackToVersion("int-1", 1);
    expect(rolled!.memories.timeline).toHaveLength(1);
    expect(rolled!.memories.timeline[0].description).toBe("original");
    expect(rolled!.memories.keyPhrases).toEqual(["orig"]);
    expect(rolled!.memories.meta.version).toBe(1);
  });

  it("mergeMemoriesLocal preserves all data fields", () => {
    const base = createEmptyMemories();
    base.meta.sourceCount = 0;
    const inc: Memories = {
      meta: { version: 1, createdAt: "t", updatedAt: "t", sourceCount: 5 },
      timeline: [{ description: "t", category: "milestone" }],
      dailyRituals: [{ name: "t", description: "t", frequency: "daily" }],
      preferences: [{ category: "t", detail: "t", confidence: "high" }],
      emotionalPatterns: [{ trigger: "t", herReaction: "t", yourTypicalResponse: "t", outcome: "t" }],
      conflictPatterns: [{ topic: "t", howItStarts: "t", howItEscalates: "t", howItResolves: "t" }],
      keyPhrases: ["t"],
      rawSummary: "test summary",
    };
    const merged = mergeMemoriesLocal(base, inc);
    expect(merged.timeline).toHaveLength(1);
    expect(merged.dailyRituals).toHaveLength(1);
    expect(merged.preferences).toHaveLength(1);
    expect(merged.emotionalPatterns).toHaveLength(1);
    expect(merged.conflictPatterns).toHaveLength(1);
    expect(merged.keyPhrases).toHaveLength(1);
    expect(merged.rawSummary).toContain("test summary");
  });
});
