import { create } from 'zustand';
import type { ViewportRect } from '../utils/viewport';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5.0;
const ZOOM_STEP = 0.1;

interface CanvasStoreState {
  // 缩放状态
  zoomLevel: number;
  viewportX: number;
  viewportY: number;
  /** 实时视口矩形（内容坐标系） */
  viewportRect: ViewportRect | null;
  /** fitToWindow 触发计数器，每次递增触发画布重置 */
  fitCounter: number;

  /** 是否显示检测框覆盖层 */
  showDetectionOverlay: boolean;

  // 纵向滚动分组状态
  /** 当前分组索引 (0-based，由 InfiniteCanvas 根据 scrollY 自动更新) */
  currentGroupIndex: number;
  /** 分组总数 */
  groupCount: number;

  // Actions
  setZoom: (level: number) => void;
  setViewport: (x: number, y: number) => void;
  setViewportRect: (rect: ViewportRect) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToWindow: () => void;
  resetZoom: () => void;

  toggleDetectionOverlay: () => void;

  // 分组导航 Actions
  setGroupCount: (count: number) => void;
  goToGroup: (index: number) => void;
  nextGroup: () => void;
  prevGroup: () => void;
}

export const useCanvasStore = create<CanvasStoreState>((set, get) => ({
  zoomLevel: 1.0,
  viewportX: 0,
  viewportY: 0,
  viewportRect: null,
  fitCounter: 0,

  currentGroupIndex: 0,
  groupCount: 0,
  showDetectionOverlay: false,

  setZoom: (level) =>
    set({ zoomLevel: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, level)) }),

  setViewport: (x, y) =>
    set({ viewportX: x, viewportY: y }),

  setViewportRect: (rect) =>
    set({ viewportRect: rect }),

  zoomIn: () =>
    set((state) => ({
      zoomLevel: Math.min(MAX_ZOOM, state.zoomLevel + ZOOM_STEP),
    })),

  zoomOut: () =>
    set((state) => ({
      zoomLevel: Math.max(MIN_ZOOM, state.zoomLevel - ZOOM_STEP),
    })),

  fitToWindow: () =>
    set((state) => ({
      viewportX: 0,
      viewportY: 0,
      viewportRect: null,
      fitCounter: state.fitCounter + 1,
    })),

  toggleDetectionOverlay: () =>
    set((state) => ({ showDetectionOverlay: !state.showDetectionOverlay })),

  resetZoom: () =>
    set({ zoomLevel: 1.0 }),

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
