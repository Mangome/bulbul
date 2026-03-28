import { create } from 'zustand';
import type { ViewportRect } from '../utils/viewport';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.1;

interface CanvasStoreState {
  // 缩放状态
  zoomLevel: number;
  viewportX: number;
  viewportY: number;
  /** 实时视口矩形（ContentLayer 坐标系） */
  viewportRect: ViewportRect | null;
  /** fitToWindow 触发计数器，每次递增触发画布重置 */
  fitCounter: number;

  // 水平分组导航状态
  /** 当前分组索引 (0-based) */
  currentGroupIndex: number;
  /** 分组总数 */
  groupCount: number;
  /** 是否正在切换分组动画中 */
  isTransitioning: boolean;

  // Actions
  setZoom: (level: number) => void;
  setViewport: (x: number, y: number) => void;
  setViewportRect: (rect: ViewportRect) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToWindow: () => void;
  resetZoom: () => void;

  // 分组导航 Actions
  setGroupCount: (count: number) => void;
  goToGroup: (index: number) => void;
  nextGroup: () => void;
  prevGroup: () => void;
  setTransitioning: (v: boolean) => void;
}

export const useCanvasStore = create<CanvasStoreState>((set, get) => ({
  zoomLevel: 1.0,
  viewportX: 0,
  viewportY: 0,
  viewportRect: null,
  fitCounter: 0,

  currentGroupIndex: 0,
  groupCount: 0,
  isTransitioning: false,

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
      zoomLevel: 1.0,
      viewportX: 0,
      viewportY: 0,
      viewportRect: null,
      fitCounter: state.fitCounter + 1,
    })),

  resetZoom: () =>
    set({ zoomLevel: 1.0 }),

  // ── 分组导航 ──

  setGroupCount: (count) =>
    set({ groupCount: count }),

  goToGroup: (index) => {
    const { groupCount } = get();
    if (groupCount === 0) return;
    const clamped = Math.max(0, Math.min(groupCount - 1, index));
    set({ currentGroupIndex: clamped, isTransitioning: true });
  },

  nextGroup: () => {
    const { currentGroupIndex, groupCount } = get();
    if (currentGroupIndex < groupCount - 1) {
      set({ currentGroupIndex: currentGroupIndex + 1, isTransitioning: true });
    }
  },

  prevGroup: () => {
    const { currentGroupIndex } = get();
    if (currentGroupIndex > 0) {
      set({ currentGroupIndex: currentGroupIndex - 1, isTransitioning: true });
    }
  },

  setTransitioning: (v) =>
    set({ isTransitioning: v }),
}));
