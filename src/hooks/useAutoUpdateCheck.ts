import { useEffect, useRef } from 'react';
import { checkForUpdate } from '../services/updaterService';
import { useToastStore } from '../stores/useToastStore';

/**
 * 启动时自动检查一次更新。
 * 仅在主窗口调用。发现新版本时弹出可点击 toast，失败或无更新时静默。
 */
export function useAutoUpdateCheck(onOpenSettings: () => void) {
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    checkForUpdate()
      .then((result) => {
        if (!result.available) return;

        useToastStore.getState().addToast({
          type: 'info',
          message: `发现新版本 v${result.update.version}，点击查看`,
          onClick: onOpenSettings,
        });
      })
      .catch(() => {
        // 静默忽略检查失败
      });
  }, [onOpenSettings]);
}
