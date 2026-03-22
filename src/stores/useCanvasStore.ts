import { create } from 'zustand';
import type { ViewportRect } from '../utils/viewport';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.1;

interface CanvasStoreState {
  // 状态
  zoomLevel: number;
  viewportX: number;
  viewportY: number;
  /** 实时视口矩形（ContentLayer 坐标系） */
  viewportRect: ViewportRect | null;
  /** fitToWindow 触发计数器，每次递增触发画布重置 */
  fitCounter: number;

  // Actions
  setZoom: (level: number) => void;
  setViewport: (x: number, y: number) => void;
  setViewportRect: (rect: ViewportRect) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToWindow: () => void;
  resetZoom: () => void;
}

export const useCanvasStore = create<CanvasStoreState>((set) => ({
  zoomLevel: 1.0,
  viewportX: 0,
  viewportY: 0,
  viewportRect: null,
  fitCounter: 0,

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
}));
