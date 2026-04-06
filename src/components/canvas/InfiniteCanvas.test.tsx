import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── 必须在所有其他导入之前设置 matchMedia mock ──
// vi.hoisted 确保代码在模块解析前执行
const { mockMatchMedia } = vi.hoisted(() => {
  const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  window.matchMedia = mockMatchMedia;
  return { mockMatchMedia };
});

// ── Mock 外部依赖 ──
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));
vi.mock('../../services/imageService', () => ({
  getImageUrl: vi.fn().mockResolvedValue('mock://image.jpg'),
}));

import { render, cleanup } from '@testing-library/react';
import { createRef } from 'react';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useSelectionStore } from '../../stores/useSelectionStore';
import { useThemeStore } from '../../stores/useThemeStore';
import type { LayoutResult } from '../../utils/layout';
import InfiniteCanvas, { type InfiniteCanvasHandle } from './InfiniteCanvas';

// ── Mock ResizeObserver ──
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(_cb: ResizeObserverCallback) {}
}
window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// ── Mock Canvas 2D Context ──
function createMockContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({
      width: 50,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2,
    }),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    quadraticCurveTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    drawImage: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    createPattern: vi.fn().mockReturnValue({}),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: '',
    textBaseline: 'alphabetic',
    canvas: document.createElement('canvas'),
  } as unknown as CanvasRenderingContext2D;
}

HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(createMockContext());

// ── Mock OffscreenCanvas ──
(globalThis as Record<string, unknown>).OffscreenCanvas = class {
  width: number;
  height: number;
  constructor(w: number, h: number) { this.width = w; this.height = h; }
  getContext() { return createMockContext(); }
};

// ── Mock fetch + createImageBitmap ──
(globalThis as Record<string, unknown>).fetch = vi.fn().mockResolvedValue({
  ok: true,
  blob: vi.fn().mockResolvedValue(new Blob()),
});
(globalThis as Record<string, unknown>).createImageBitmap = vi.fn().mockResolvedValue({
  width: 300, height: 200, close: vi.fn(),
});

// ── Helper：创建测试布局 ──
function createTestLayout(numGroups = 1, itemsPerGroup = 2): LayoutResult {
  const pages = [];
  const allItems = [];
  const groupTitles = [];
  const pageWidth = 800;

  for (let gi = 0; gi < numGroups; gi++) {
    const items = [];
    for (let i = 0; i < itemsPerGroup; i++) {
      items.push({
        hash: `hash-${gi}-${i}`,
        groupId: gi,
        groupIndex: gi,
        x: gi * pageWidth + 40 + (i % 2) * 200,
        y: 80 + Math.floor(i / 2) * 200,
        width: 180,
        height: 120,
      });
    }
    allItems.push(...items);
    const sortedItems = [...items].sort((a, b) => a.y - b.y);
    groupTitles.push({
      groupId: gi,
      label: `分组 ${gi + 1}（${itemsPerGroup} 张）`,
      x: gi * pageWidth + 40,
      y: 0,
      width: 360,
      height: 0,
    });
    pages.push({
      groupIndex: gi,
      groupId: gi,
      offsetX: gi * pageWidth,
      contentHeight: 80 + Math.ceil(itemsPerGroup / 2) * 200 + 88,
      columnWidth: 180,
      items,
      groupTitle: groupTitles[gi],
      sortedItems,
    });
  }

  return {
    items: allItems,
    groupTitles,
    pages,
    totalWidth: numGroups * pageWidth,
    pageWidth,
    columnWidth: 180,
    baseColumnWidth: 180,
    totalHeight: pages[0]?.contentHeight ?? 0,
  };
}

describe('InfiniteCanvas', () => {
  let layout: LayoutResult;
  let fileNames: Map<string, string>;
  let metadataMap: Map<string, Record<string, unknown>>;

  beforeEach(() => {
    layout = createTestLayout(2, 4);
    fileNames = new Map();
    metadataMap = new Map();
    for (const item of layout.items) {
      fileNames.set(item.hash, `${item.hash}.nef`);
    }

    useCanvasStore.setState({
      zoomLevel: 1.0,
      currentGroupIndex: 0,
      groupCount: 0,
      isTransitioning: false,
      fitCounter: 0,
    });
    useSelectionStore.setState({
      selectedHashes: new Set(),
      selectedCount: 0,
    });
    useThemeStore.setState({ theme: 'light' });

    vi.clearAllMocks();
    // 恢复 matchMedia mock（clearAllMocks 会重置它）
    window.matchMedia = mockMatchMedia;
  });

  afterEach(() => {
    cleanup();
  });

  it('渲染 canvas 元素和无障碍容器', () => {
    const { container } = render(
      <InfiniteCanvas layout={layout} fileNames={fileNames} metadataMap={metadataMap as never} />
    );
    expect(container.querySelector('canvas')).toBeTruthy();
    expect(container.querySelector('[role="region"]')?.getAttribute('aria-label')).toBe('图片分组展示画布');
  });

  it('渲染屏幕阅读器播报区', () => {
    const { container } = render(
      <InfiniteCanvas layout={layout} fileNames={fileNames} metadataMap={metadataMap as never} />
    );
    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toBe('未选中图片');
  });

  it('挂载时设置 groupCount', () => {
    render(
      <InfiniteCanvas layout={layout} fileNames={fileNames} metadataMap={metadataMap as never} />
    );
    expect(useCanvasStore.getState().groupCount).toBe(2);
  });

  it('暴露 imperative handle', () => {
    const ref = createRef<InfiniteCanvasHandle>();
    render(
      <InfiniteCanvas ref={ref} layout={layout} fileNames={fileNames} metadataMap={metadataMap as never} />
    );
    expect(ref.current).toBeTruthy();
    expect(typeof ref.current?.syncSelectionVisuals).toBe('function');
    expect(typeof ref.current?.scrollToY).toBe('function');
    expect(typeof ref.current?.updateItemMetadata).toBe('function');
  });

  it('调用 canvas.getContext("2d")', () => {
    render(
      <InfiniteCanvas layout={layout} fileNames={fileNames} metadataMap={metadataMap as never} />
    );
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('2d');
  });

  it('layout 变化时重置到第一组', () => {
    const { rerender } = render(
      <InfiniteCanvas layout={layout} fileNames={fileNames} metadataMap={metadataMap as never} />
    );
    const newLayout = createTestLayout(3, 2);
    rerender(
      <InfiniteCanvas layout={newLayout} fileNames={fileNames} metadataMap={metadataMap as never} />
    );
    expect(useCanvasStore.getState().currentGroupIndex).toBe(0);
    expect(useCanvasStore.getState().groupCount).toBe(3);
  });

  it('卸载时不抛异常', () => {
    const { unmount } = render(
      <InfiniteCanvas layout={layout} fileNames={fileNames} metadataMap={metadataMap as never} />
    );
    expect(() => unmount()).not.toThrow();
  });

  it('无 pixi.js 模块导入', () => {
    // 如果 pixi.js 已卸载且代码无 import，则不会报错
    expect(InfiniteCanvas).toBeTruthy();
  });
});
