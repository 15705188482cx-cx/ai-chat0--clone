import { createEmptyMemories } from "../../src/modules/persona/memoriesAnalyzer";
import {
  formatMemories,
  summarizeMemories,
  buildMemoriesContext,
} from "../../src/modules/persona/memoriesBuilder";
import { mergeMemoriesLocal } from "../../src/modules/persona/merger";
import {
  createSnapshot,
  getVersionHistory,
  rollbackToVersion,
  getLatestVersion,
} from "../../src/modules/persona/versionManager";
import type { Persona } from "../../src/modules/persona/types";
import type { Memories } from "../../src/modules/persona/memoriesTypes";

const sampleMemories: Memories = {
  meta: { version: 1, createdAt: "2024-01-01", updatedAt: "2024-01-01", sourceCount: 100 },
  timeline: [
    { date: "2023-03-15", description: "first date", category: "milestone" },
    { date: "2023-07-20", description: "trip to Dali", category: "travel" },
  ],
  dailyRituals: [
    { name: "goodnight", description: "say goodnight every night", frequency: "daily" },
  ],
  preferences: [
    { category: "food", detail: "likes hotpot", confidence: "high" },
  ],
  emotionalPatterns: [
    { trigger: "slow reply", herReaction: "gets angry", yourTypicalResponse: "apologize", outcome: "makes up" },
  ],
  conflictPatterns: [
    { topic: "weekend plans", howItStarts: "disagree", howItEscalates: "she says forget it", howItResolves: "you give in" },
  ],
  keyPhrases: ["whatever", "hmph", "miss you"],
  rawSummary: "test summary",
};

describe("memoriesBuilder", () => {
  it("formats full memories", () => {
    const result = formatMemories(sampleMemories);
    expect(result).toContain("first date");
    expect(result).toContain("food");
    expect(result).toContain("goodnight");
  });

  it("summarizes memories", () => {
    const result = summarizeMemories(sampleMemories);
    expect(result).toContain("2");
  });

  it("handles empty memories", () => {
    const empty = createEmptyMemories();
    expect(formatMemories(empty)).toContain("共同记忆");
    expect(summarizeMemories(empty)).toContain("共同记忆");
  });

  it("builds context with length limit", () => {
    const result = buildMemoriesContext(sampleMemories, 200);
    expect(result.length).toBeLessThanOrEqual(400);
  });
});

describe("merger", () => {
  const existing: Memories = {
    meta: { version: 1, createdAt: "2024-01-01", updatedAt: "2024-01-01", sourceCount: 50 },
    timeline: [{ date: "2023-03-15", description: "first date", category: "milestone" }],
    dailyRituals: [{ name: "goodnight", description: "say goodnight", frequency: "daily" }],
    preferences: [{ category: "food", detail: "likes hotpot", confidence: "high" }],
    emotionalPatterns: [],
    conflictPatterns: [],
    keyPhrases: ["miss you"],
    rawSummary: "initial",
  };

  const incoming: Memories = {
    meta: { version: 1, createdAt: "2024-02-01", updatedAt: "2024-02-01", sourceCount: 30 },
    timeline: [{ date: "2023-07-20", description: "trip to Dali", category: "travel" }],
    dailyRituals: [{ name: "morning", description: "wake up call", frequency: "daily" }],
    preferences: [
      { category: "food", detail: "likes hotpot", confidence: "high" },
      { category: "entertainment", detail: "likes movies", confidence: "medium" },
    ],
    emotionalPatterns: [{ trigger: "slow reply", herReaction: "angry", yourTypicalResponse: "apologize", outcome: "ok" }],
    conflictPatterns: [],
    keyPhrases: ["annoying", "miss you"],
    rawSummary: "new",
  };

  it("increments version on merge", () => {
    const result = mergeMemoriesLocal(existing, incoming);
    expect(result.meta.version).toBe(2);
    expect(result.meta.sourceCount).toBe(80);
  });

  it("deduplicates timeline by description", () => {
    const result = mergeMemoriesLocal(existing, incoming);
    expect(result.timeline.length).toBe(2);
  });

  it("deduplicates keyPhrases", () => {
    const result = mergeMemoriesLocal(existing, incoming);
    expect(result.keyPhrases).toContain("miss you");
    expect(result.keyPhrases).toContain("annoying");
    expect(result.keyPhrases.length).toBe(2);
  });

  it("empty incoming preserves existing", () => {
    const empty = createEmptyMemories();
    empty.meta.sourceCount = 0;
    const result = mergeMemoriesLocal(existing, empty);
    expect(result.timeline.length).toBe(1);
  });
});

describe("versionManager", () => {
  const persona: Persona = {
    id: "test-p-1",
    name: "Test",
    sourceSender: "tester",
    chatSampleIds: [],
    styleSummary: "test style",
    createdAt: "2024-01-01",
  };

  const memories: Memories = {
    meta: { version: 1, createdAt: "2024-01-01", updatedAt: "2024-01-01", sourceCount: 10 },
    timeline: [{ description: "event", category: "milestone" }],
    dailyRituals: [],
    preferences: [],
    emotionalPatterns: [],
    conflictPatterns: [],
    keyPhrases: [],
    rawSummary: "",
  };

  it("creates and lists snapshots", () => {
    createSnapshot(persona, memories, "first");
    const history = getVersionHistory("test-p-1");
    expect(history.length).toBe(1);
    expect(history[0].version).toBe(1);
  });

  it("multiple snapshots", () => {
    const v2 = { ...memories, meta: { ...memories.meta, version: 2 } };
    createSnapshot(persona, v2, "second");
    expect(getVersionHistory("test-p-1").length).toBe(2);
  });

  it("rolls back to version", () => {
    const result = rollbackToVersion("test-p-1", 1);
    expect(result).not.toBeNull();
    expect(result!.memories.meta.version).toBe(1);
  });

  it("rollback to missing version returns null", () => {
    expect(rollbackToVersion("test-p-1", 999)).toBeNull();
  });

  it("gets latest version", () => {
    expect(getLatestVersion("test-p-1")).toBe(2);
  });

  it("unknown persona returns version 0", () => {
    expect(getLatestVersion("unknown")).toBe(0);
  });
});

describe("createEmptyMemories", () => {
  it("returns empty structure with meta", () => {
    const result = createEmptyMemories();
    expect(result.meta.version).toBe(1);
    expect(result.timeline).toHaveLength(0);
    expect(result.keyPhrases).toHaveLength(0);
  });
});
