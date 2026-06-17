// =============================================================================
// useFirstLaunch - 检测首启动状态(基于 store 内容,无独立 flag)
// 规则 6(最小实现): 不持久化 onboarding 标记,基于"无数据 + 无分身"判定
// 设计: 清空数据后会自动重新触发 onboarding(用户意图上是"重新开始")
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import { getStore } from "../modules/database/storeProvider";
import { hasApiKeySync as hasKeySync } from "../modules/config/apiKeyManager";

export interface FirstLaunchState {
  isLoading: boolean;
  needsOnboarding: boolean;
  hasKey: boolean;
  hasData: boolean;
  hasPersona: boolean;
  refresh: () => Promise<void>;
}

/**
 * 检测首启动三态:
 * - hasData:   chat_record 表里有数据
 * - hasKey:    API Key 已配置
 * - hasPersona: 已有至少一个分身
 * needsOnboarding = !hasData && !hasPersona (空状态)
 */
export function useFirstLaunch(): FirstLaunchState {
  const [isLoading, setIsLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [hasPersona, setHasPersona] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const store = await getStore();
      const [count, personas] = await Promise.all([
        store.getChatRecordCount(),
        store.getAllPersonas(),
      ]);
      setHasData(count > 0);
      setHasPersona(personas.length > 0);
      setHasKey(hasKeySync());
    } catch (err) {
      console.warn("[useFirstLaunch] 检测失败:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    isLoading,
    needsOnboarding: !hasData && !hasPersona,
    hasKey,
    hasData,
    hasPersona,
    refresh,
  };
}
