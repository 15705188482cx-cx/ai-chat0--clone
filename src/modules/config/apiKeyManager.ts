/**
 * API Key Manager - Web + Native compatible storage
 * Native: uses SecureStore (iOS Keychain / Android Keystore)
 * Web: falls back to localStorage
 */
import { Platform } from "react-native";

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
  } catch {}
  return null;
}

export async function setApiKey(key: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(API_KEY_KEY, key);
    return;
  }
  // Native: try SecureStore first, fallback to localStorage
  const store = await getSecureStoreModule();
  if (store) {
    await store.setItemAsync(API_KEY_KEY, key);
  } else {
    localStorage.setItem(API_KEY_KEY, key);
  }
}

export async function getApiKey(): Promise<string | null> {
  // Try localStorage first (fast path for web and fallback)
  try {
    const stored = localStorage.getItem(API_KEY_KEY);
    if (stored) return stored;
  } catch {}

  // Native: try SecureStore
  if (Platform.OS !== "web") {
    const store = await getSecureStoreModule();
    if (store) {
      try {
        const stored = await store.getItemAsync(API_KEY_KEY);
        if (stored) return stored;
      } catch {}
    }
  }

  return null;
}

export async function deleteApiKey(): Promise<void> {
  // Always clear localStorage
  try {
    localStorage.removeItem(API_KEY_KEY);
  } catch {}

  // Native: also clear SecureStore
  if (Platform.OS !== "web") {
    const store = await getSecureStoreModule();
    if (store) {
      try {
        await store.deleteItemAsync(API_KEY_KEY);
      } catch {}
    }
  }
}

/**
 * Check if API key exists (fast, no async for web)
 */
export function hasApiKeySync(): boolean {
  try {
    return !!localStorage.getItem(API_KEY_KEY);
  } catch {
    return false;
  }
}
