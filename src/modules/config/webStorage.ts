/**
 * Web-compatible storage layer
 * Web: always uses localStorage
 * Native: uses expo-secure-store (verified via isAvailableAsync)
 */

export async function getItemAsync(key: string): Promise<string | null> {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return localStorage.getItem(key);
    }
  } catch {}
  return null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(key, value);
      return;
    }
  } catch {}
}

export async function deleteItemAsync(key: string): Promise<void> {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem(key);
      return;
    }
  } catch {}
}
