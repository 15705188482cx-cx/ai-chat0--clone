// =============================================================================
// API Key Manager — Web + Native 兼容存储
// 规则 4(显式错误): 不允许空 catch
// 规则 3(无魔法值): API_KEY_KEY 是常量
// =============================================================================

import { Platform } from "react-native";

/** localStorage / SecureStore 存储键名 */
const API_KEY_KEY = "DEEPSEEK_API_KEY";

let _secureStoreModule: any = null;

async function getSecureStoreModule(): Promise<any | null> {
  if (_secureStoreModule) return _secureStoreModule;
  try {
    const mod = await import("expo-secure-store");
    if (mod && typeof mod.isAvailableAsync === "function") {
      const available = await mod.isAvailableAsync();
      if (available) {
        _secureStoreModule = mod;
        return mod;
      }
    }
  } catch (err) {
    console.warn("[apiKeyManager] expo-secure-store 不可用:", err);
  }
  return null;
}

export async function setApiKey(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(API_KEY_KEY, key);
    return;
  }
  const store = await getSecureStoreModule();
  if (store) {
    try {
      await store.setItemAsync(API_KEY_KEY, key);
    } catch (err) {
      console.error("[apiKeyManager] SecureStore 写入失败:", err);
    }
  }
  // 始终同步到 localStorage 作为 fallback
  try {
    localStorage.setItem(API_KEY_KEY, key);
  } catch (err) {
    console.error("[apiKeyManager] localStorage 写入失败:", err);
  }
}

export async function getApiKey(): Promise<string | null> {
  try {
    const stored = localStorage.getItem(API_KEY_KEY);
    if (stored) return stored;
  } catch (err) {
    console.warn("[apiKeyManager] localStorage 读取失败:", err);
  }

  if (Platform.OS !== "web") {
    const store = await getSecureStoreModule();
    if (store) {
      try {
        const stored = await store.getItemAsync(API_KEY_KEY);
        if (stored) return stored;
      } catch (err) {
        console.warn("[apiKeyManager] SecureStore 读取失败:", err);
      }
    }
  }

  return null;
}

export async function deleteApiKey(): Promise<void> {
  try {
    localStorage.removeItem(API_KEY_KEY);
  } catch (err) {
    console.warn("[apiKeyManager] localStorage 删除失败:", err);
  }

  if (Platform.OS !== "web") {
    const store = await getSecureStoreModule();
    if (store) {
      try {
        await store.deleteItemAsync(API_KEY_KEY);
      } catch (err) {
        console.warn("[apiKeyManager] SecureStore 删除失败:", err);
      }
    }
  }
}

/**
 * 同步检查 API Key 是否存在。
 */
export function hasApiKeySync(): boolean {
  try {
    return !!localStorage.getItem(API_KEY_KEY);
  } catch (err) {
    console.warn("[apiKeyManager] hasApiKeySync 读取失败:", err);
    return false;
  }
}
