import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from './useCanvasStore';

describe('useCanvasStore', () => {
  beforeEach(() => {
    // 重置 store 状态
    useCanvasStore.setState({
      viewportX: 0,
      viewportY: 0,
      viewportRect: null,
      showDetectionOverlay: false,
    });
  });

  describe('setViewport', () => {
    it('应更新视口坐标', () => {
      useCanvasStore.getState().setViewport(100, 200);
      const state = useCanvasStore.getState();
      expect(state.viewportX).toBe(100);
      expect(state.viewportY).toBe(200);
    });
  });

  describe('setViewportRect', () => {
    it('应更新视口矩形', () => {
      const rect = { x: 10, y: 20, width: 800, height: 600 };
      useCanvasStore.getState().setViewportRect(rect);
      expect(useCanvasStore.getState().viewportRect).toEqual(rect);
    });

    it('初始值为 null', () => {
      expect(useCanvasStore.getState().viewportRect).toBeNull();
    });
  });

  describe('toggleDetectionOverlay', () => {
    it('初始值应为 false', () => {
      expect(useCanvasStore.getState().showDetectionOverlay).toBe(false);
    });

    it('切换为 true', () => {
      useCanvasStore.getState().toggleDetectionOverlay();
      expect(useCanvasStore.getState().showDetectionOverlay).toBe(true);
    });

    it('再次切换回 false', () => {
      useCanvasStore.getState().toggleDetectionOverlay();
      useCanvasStore.getState().toggleDetectionOverlay();
      expect(useCanvasStore.getState().showDetectionOverlay).toBe(false);
    });
  });
});
