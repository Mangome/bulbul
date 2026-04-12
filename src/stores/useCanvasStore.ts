import { create } from 'zustand';
import type { ViewportRect } from '../utils/viewport';

interface CanvasStoreState {
  viewportX: number;
  viewportY: number;
  /** 实时视口矩形（内容坐标系） */
  viewportRect: ViewportRect | null;

  /** 是否显示检测框覆盖层 */
  showDetectionOverlay: boolean;

  // 纵向滚动分组状态
  /** 当前分组索引 (0-based，由 InfiniteCanvas 根据 scrollY 自动更新) */
  currentGroupIndex: number;
  /** 分组总数 */
  groupCount: number;

  // Actions
  setViewport: (x: number, y: number) => void;
  setViewportRect: (rect: ViewportRect) => void;

  toggleDetectionOverlay: () => void;

  // 分组导航 Actions
  setGroupCount: (count: number) => void;
  goToGroup: (index: number) => void;
  nextGroup: () => void;
  prevGroup: () => void;
}

export const useCanvasStore = create<CanvasStoreState>((set, get) => ({
  viewportX: 0,
  viewportY: 0,
  viewportRect: null,

  currentGroupIndex: 0,
  groupCount: 0,
  showDetectionOverlay: false,

  setViewport: (x, y) =>
    set({ viewportX: x, viewportY: y }),

  setViewportRect: (rect) =>
    set({ viewportRect: rect }),

  toggleDetectionOverlay: () =>
    set((state) => ({ showDetectionOverlay: !state.showDetectionOverlay })),

  // ── 分组导航 ──

  setGroupCount: (count) =>
    set({ groupCount: count }),

  goToGroup: (index) => {
    const { groupCount } = get();
    if (groupCount === 0) return;
    const clamped = Math.max(0, Math.min(groupCount - 1, index));
    set({ currentGroupIndex: clamped });
  },

  nextGroup: () => {
    const { currentGroupIndex, groupCount } = get();
    if (currentGroupIndex < groupCount - 1) {
      set({ currentGroupIndex: currentGroupIndex + 1 });
    } else {
      // 循环到第一个分组
      set({ currentGroupIndex: 0 });
    }
  },

  prevGroup: () => {
    const { currentGroupIndex, groupCount } = get();
    if (currentGroupIndex > 0) {
      set({ currentGroupIndex: currentGroupIndex - 1 });
    } else {
      // 循环到最后一个分组
      set({ currentGroupIndex: groupCount - 1 });
    }
  },
}));
