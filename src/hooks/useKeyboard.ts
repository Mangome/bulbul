// ============================================================
// 键盘快捷键 Hook (useKeyboard)
//
// 在 MainPage 挂载时注册 window keydown 监听，卸载时移除。
// 支持 Left/Right 分组切换、W/S 组内滚动、Ctrl 组合键、Escape 多功能。
// 输入框聚焦时跳过所有快捷键。
// ============================================================

import { useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { useSelectionStore } from '../stores/useSelectionStore';
import { useCanvasStore } from '../stores/useCanvasStore';

// ─── 类型 ─────────────────────────────────────────────

export interface UseKeyboardOptions {
  /** 打开文件夹回调 */
  onOpenFolder: () => void;
  /** 导出回调 */
  onExport: () => void;
  /** 分组跳转回调（切换后触发画布滚动） */
  onGroupNavigated?: () => void;
}

// ─── 常量 ─────────────────────────────────────────────

/** 分组导航节流间隔（ms），防止快速连按导致动画/纹理堆叠白屏 */
const NAVIGATION_THROTTLE_MS = 200;

// ─── 辅助 ─────────────────────────────────────────────

/** 判断当前焦点是否在输入控件上 */
function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

// ─── Hook ─────────────────────────────────────────────

export function useKeyboard({
  onOpenFolder,
  onExport,
  onGroupNavigated,
}: UseKeyboardOptions): void {
  useEffect(() => {
    let lastNavigationTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 输入框聚焦时跳过
      if (isInputFocused()) return;

      const ctrl = e.ctrlKey || e.metaKey;

      // ── Ctrl 组合键 ──
      if (ctrl) {
        switch (e.key.toLowerCase()) {
          case 'o':
            e.preventDefault();
            onOpenFolder();
            return;
          case 'e':
            e.preventDefault();
            onExport();
            return;
        }
        return;
      }

      // ── 单键 ──
      switch (e.key) {
        // 左右箭头 / A/D → 水平分组切换（节流保护）
        case 'ArrowLeft':
        case 'a':
        case 'A': {
          e.preventDefault();
          const now = Date.now();
          if (now - lastNavigationTime < NAVIGATION_THROTTLE_MS) return;
          lastNavigationTime = now;
          useCanvasStore.getState().prevGroup();
          useAppStore.getState().navigateGroup('prev');
          onGroupNavigated?.();
          return;
        }
        case 'ArrowRight':
        case 'd':
        case 'D': {
          e.preventDefault();
          const now = Date.now();
          if (now - lastNavigationTime < NAVIGATION_THROTTLE_MS) return;
          lastNavigationTime = now;
          useCanvasStore.getState().nextGroup();
          useAppStore.getState().navigateGroup('next');
          onGroupNavigated?.();
          return;
        }

        // W/S/上下箭头不再切组，预留给组内滚动（画布层面通过滚轮处理）
        case 'Escape': {
          e.preventDefault();
          const selectionStore = useSelectionStore.getState();
          if (selectionStore.selectedCount > 0) {
            selectionStore.clearSelection();
            return;
          }
          // 处理中按 Escape → 取消处理
          const { processingState } = useAppStore.getState();
          const cancelableStates = ['scanning', 'processing', 'analyzing', 'grouping'];
          if (cancelableStates.includes(processingState)) {
            useAppStore.getState().setProcessingState('cancelling');
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenFolder, onExport, onGroupNavigated]);
}
