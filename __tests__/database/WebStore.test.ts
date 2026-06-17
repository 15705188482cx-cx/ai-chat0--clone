/** @jest-environment jsdom */
import { WebStore } from "../../src/modules/database/WebStore";
import { StoreNotReadyError, InvalidArgumentError } from "../../src/modules/database/IDataStore";

jest.mock("react-native", () => ({ Platform: { OS: "web" } }));
jest.mock("nanoid", () => ({ nanoid: jest.fn(() => Math.random().toString(36).slice(2, 10)) }));

describe("WebStore", () => {
  let store: WebStore;

  beforeEach(() => {
    localStorage.clear();
    store = new WebStore();
  });

  it("未初始化时调用应抛出 StoreNotReadyError", async () => {
    await expect(store.getChatRecordCount()).rejects.toThrow(StoreNotReadyError);
  });

  it("初始化和基本 CRUD", async () => {
    await store.init();
    expect(await store.getChatRecordCount()).toBe(0);
    await store.bulkInsertChatRecords([
      { batch_id: "b1", sender_name: "Alice", content: "Hi", timestamp: "2024-01-01T00:00:00Z", session_id: null, type: "text" },
    ]);
    expect(await store.getChatRecordCount()).toBe(1);
    expect(await store.getDistinctSenders()).toEqual(["Alice"]);
  });

  it("savePersona + getPersonaById", async () => {
    await store.init();
    await store.savePersona({ id: "p1", name: "Alice", sourceSender: "Alice", chatSampleIds: [], styleSummary: "", createdAt: "2024-01" });
    expect((await store.getPersonaById("p1"))?.name).toBe("Alice");
    expect(await store.getPersonaById("nope")).toBeNull();
  });

  it("savePersona 空 id 应抛出 InvalidArgumentError", async () => {
    await store.init();
    await expect(store.savePersona({ id: "", name: "x", sourceSender: "y", chatSampleIds: [], styleSummary: "", createdAt: "z" })).rejects.toThrow(InvalidArgumentError);
  });

  it("createConversation + updateTitle", async () => {
    await store.init();
    await store.savePersona({ id: "p1", name: "T", sourceSender: "A", chatSampleIds: [], styleSummary: "", createdAt: "2024" });
    const conv = await store.createConversation("p1", "Old");
    await store.updateConversationTitle(conv.id, "New");
    expect((await store.getConversationById(conv.id))?.title).toBe("New");
  });

  it("deleteConversation 级联删除消息", async () => {
    await store.init();
    await store.savePersona({ id: "p1", name: "T", sourceSender: "A", chatSampleIds: [], styleSummary: "", createdAt: "2024" });
    const conv = await store.createConversation("p1");
    await store.insertMessage(conv.id, "user", "msg");
    await store.deleteConversation(conv.id);
    expect(await store.getConversationById(conv.id)).toBeNull();
  });

  it("insertMessage 无效 role 应抛出", async () => {
    await store.init();
    await store.savePersona({ id: "p1", name: "T", sourceSender: "A", chatSampleIds: [], styleSummary: "", createdAt: "2024" });
    const conv = await store.createConversation("p1");
    await expect(store.insertMessage(conv.id, "admin" as any, "x")).rejects.toThrow(InvalidArgumentError);
  });

  it("getLatestMessages 按时间正序", async () => {
    await store.init();
    await store.savePersona({ id: "p1", name: "T", sourceSender: "A", chatSampleIds: [], styleSummary: "", createdAt: "2024" });
    const conv = await store.createConversation("p1");
    await store.insertMessage(conv.id, "user", "A");
    await store.insertMessage(conv.id, "persona", "B");
    const msgs = await store.getLatestMessages(conv.id, 10);
    expect(msgs[0].text_content).toBe("A");
    expect(msgs[1].text_content).toBe("B");
  });

  it("表情包 CRUD", async () => {
    await store.init();
    const s = await store.insertSticker({ filePath: "/s.jpg", label: "happy" });
    expect((await store.getAllStickers()).length).toBe(1);
    await store.deleteStickerById(s.id);
    expect((await store.getAllStickers()).length).toBe(0);
  });

  it("getConversationPairs", async () => {
    await store.init();
    await store.bulkInsertChatRecords([
      { batch_id: "b1", sender_name: "ME", content: "Hi", timestamp: "2024-01-01T00:00:00Z", session_id: null, type: "text" },
      { batch_id: "b1", sender_name: "HER", content: "Hey", timestamp: "2024-01-01T00:01:00Z", session_id: null, type: "text" },
    ]);
    const pairs = await store.getConversationPairs("ME", "HER");
    expect(pairs.length).toBeGreaterThanOrEqual(1);
  });

  it("clearChatRecords 清空", async () => {
    await store.init();
    await store.bulkInsertChatRecords([
      { batch_id: "b1", sender_name: "A", content: "x", timestamp: "2024-01-01T00:00:00Z", session_id: null, type: "text" },
    ]);
    await store.clearChatRecords();
    expect(await store.getChatRecordCount()).toBe(0);
  });

  
});
