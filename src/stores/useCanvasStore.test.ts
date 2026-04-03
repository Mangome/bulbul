import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from './useCanvasStore';

describe('useCanvasStore', () => {
  beforeEach(() => {
    // 重置 store 状态
    useCanvasStore.setState({
      zoomLevel: 1.0,
      viewportX: 0,
      viewportY: 0,
      viewportRect: null,
      fitCounter: 0,
    });
  });

  describe('setZoom', () => {
    it('应设置正常范围内的缩放级别', () => {
      useCanvasStore.getState().setZoom(1.5);
      expect(useCanvasStore.getState().zoomLevel).toBe(1.5);
    });

    it('不应低于最小缩放 0.1', () => {
      useCanvasStore.getState().setZoom(0.01);
      expect(useCanvasStore.getState().zoomLevel).toBe(0.1);
    });

    it('不应高于最大缩放 3.0', () => {
      useCanvasStore.getState().setZoom(5.0);
      expect(useCanvasStore.getState().zoomLevel).toBe(3.0);
    });

    it('边界值：恰好 0.1', () => {
      useCanvasStore.getState().setZoom(0.1);
      expect(useCanvasStore.getState().zoomLevel).toBe(0.1);
    });

    it('边界值：恰好 3.0', () => {
      useCanvasStore.getState().setZoom(3.0);
      expect(useCanvasStore.getState().zoomLevel).toBe(3.0);
    });
  });

  describe('zoomIn / zoomOut', () => {
    it('zoomIn 增加 0.1', () => {
      useCanvasStore.getState().zoomIn();
      expect(useCanvasStore.getState().zoomLevel).toBeCloseTo(1.1);
    });

    it('zoomOut 减少 0.1', () => {
      useCanvasStore.getState().zoomOut();
      expect(useCanvasStore.getState().zoomLevel).toBeCloseTo(0.9);
    });

    it('zoomIn 不超过上限', () => {
      useCanvasStore.getState().setZoom(3.0);
      useCanvasStore.getState().zoomIn();
      expect(useCanvasStore.getState().zoomLevel).toBe(3.0);
    });

    it('zoomOut 不低于下限', () => {
      useCanvasStore.getState().setZoom(0.1);
      useCanvasStore.getState().zoomOut();
      expect(useCanvasStore.getState().zoomLevel).toBe(0.1);
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

  describe('fitToWindow', () => {
    it('应重置视口并递增 fitCounter，不改变 zoomLevel', () => {
      useCanvasStore.getState().setZoom(2.0);
      useCanvasStore.getState().setViewport(100, 200);
      useCanvasStore.getState().setViewportRect({ x: 10, y: 20, width: 800, height: 600 });

      useCanvasStore.getState().fitToWindow();

      const state = useCanvasStore.getState();
      expect(state.zoomLevel).toBe(2.0); // zoomLevel 不由 store 重置，由画布计算
      expect(state.viewportX).toBe(0);
      expect(state.viewportY).toBe(0);
      expect(state.viewportRect).toBeNull();
      expect(state.fitCounter).toBe(1);
    });

    it('多次调用 fitToWindow 应持续递增 fitCounter', () => {
      useCanvasStore.getState().fitToWindow();
      useCanvasStore.getState().fitToWindow();
      expect(useCanvasStore.getState().fitCounter).toBe(2);
    });
  });

  describe('resetZoom', () => {
    it('应只重置缩放，保留视口', () => {
      useCanvasStore.getState().setZoom(2.0);
      useCanvasStore.getState().setViewport(100, 200);

      useCanvasStore.getState().resetZoom();

      const state = useCanvasStore.getState();
      expect(state.zoomLevel).toBe(1.0);
      expect(state.viewportX).toBe(100); // 保留
      expect(state.viewportY).toBe(200); // 保留
    });
  });
});
