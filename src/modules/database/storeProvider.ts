// =============================================================================
// storeProvider — 全局存储层提供者
// 规则 5(可测试性): 通过 getStore() 注入，通过 setStoreForTest() 可 Mock
// 规则 7(失败快速): 初始化失败立即抛异常
// =============================================================================

import { Platform } from "react-native";
import type { IDataStore } from "./IDataStore";
import { WebStore } from "./WebStore";
import { NativeStore } from "./NativeStore";

/** 全局单例 */
let store: IDataStore | null = null;

/**
 * 获取当前平台的存储层实例。
 * 契约：返回已 init() 的 IDataStore 实例。
 * 不变式：返回值 !== null。
 * @throws 初始化失败时抛异常
 */
export async function getStore(): Promise<IDataStore> {
  if (store) return store;

  if (Platform.OS === "web") {
    const webStore = new WebStore();
    await webStore.init();
    store = webStore;
    console.log("[storeProvider] 使用 WebStore (localStorage)");
  } else {
    const nativeStore = new NativeStore();
    await nativeStore.init();
    store = nativeStore;
    console.log("[storeProvider] 使用 NativeStore (SQLite)");
  }

  return store;
}

/**
 * 测试用: 注入 Mock Store。
 * 在测试文件的 beforeAll 中调用。
 */
export function setStoreForTest(mockStore: IDataStore): void {
  store = mockStore;
  console.log("[storeProvider] 已注入测试 Store");
}

/** 重置 Store（仅测试用） */
export function resetStore(): void {
  store = null;
}
