import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from './useCanvasStore';

describe('useCanvasStore', () => {
  beforeEach(() => {
    useCanvasStore.getState().resetZoom();
    useCanvasStore.getState().setViewport(0, 0);
  });

  it('should have correct initial state', () => {
    const state = useCanvasStore.getState();
    expect(state.zoomLevel).toBe(1.0);
    expect(state.viewportX).toBe(0);
    expect(state.viewportY).toBe(0);
  });

  it('should limit zoom to max 3.0', () => {
    useCanvasStore.getState().setZoom(5.0);
    expect(useCanvasStore.getState().zoomLevel).toBe(3.0);
  });

  it('should limit zoom to min 0.1', () => {
    useCanvasStore.getState().setZoom(0.01);
    expect(useCanvasStore.getState().zoomLevel).toBeCloseTo(0.1);
  });

  it('should zoom in by 0.1 step', () => {
    useCanvasStore.getState().setZoom(1.0);
    useCanvasStore.getState().zoomIn();
    expect(useCanvasStore.getState().zoomLevel).toBeCloseTo(1.1);
  });

  it('should zoom out by 0.1 step', () => {
    useCanvasStore.getState().setZoom(1.0);
    useCanvasStore.getState().zoomOut();
    expect(useCanvasStore.getState().zoomLevel).toBeCloseTo(0.9);
  });

  it('should not zoom in beyond max', () => {
    useCanvasStore.getState().setZoom(3.0);
    useCanvasStore.getState().zoomIn();
    expect(useCanvasStore.getState().zoomLevel).toBe(3.0);
  });

  it('should not zoom out below min', () => {
    useCanvasStore.getState().setZoom(0.1);
    useCanvasStore.getState().zoomOut();
    expect(useCanvasStore.getState().zoomLevel).toBeCloseTo(0.1);
  });

  it('should reset zoom to 1.0', () => {
    useCanvasStore.getState().setZoom(2.5);
    useCanvasStore.getState().resetZoom();
    expect(useCanvasStore.getState().zoomLevel).toBe(1.0);
  });
});
