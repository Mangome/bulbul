import { useEffect, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

/**
 * 通用 Tauri 事件监听 Hook
 *
 * 自动注册/清理事件监听器，组件卸载时自动取消
 */
export function useTauriEvents<T>(
  eventName: string,
  callback: (payload: T) => void,
): void {
  // 用 ref 持有最新的回调，避免 effect 重新注册
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    let cancelled = false;

    const setup = async () => {
      unlisten = await listen<T>(eventName, (event) => {
        if (!cancelled) {
          callbackRef.current(event.payload);
        }
      });
    };

    setup();

    return () => {
      cancelled = true;
      if (unlisten) {
        unlisten();
      }
    };
  }, [eventName]);
}
