// ============================================================
// 无限画布 (InfiniteCanvas)
//
// React 组件，管理 PixiJS Application 生命周期。
// 内部通过命令式 API 控制 PixiJS 对象，不使用 @pixi/react。
//
// 层级结构:
// Stage
// ├── BackgroundLayer (DotBackground) — 固定视口坐标
// └── ContentLayer (Container) — 可缩放/平移
//     ├── GroupTitle × N
//     └── CanvasImageItem × N (由虚拟化引擎管理)
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { Application, Container } from 'pixi.js';
import { DotBackground } from './DotBackground';
import { CanvasImageItem } from './CanvasImageItem';
import { GroupTitle } from './GroupTitle';
import { ImageLoader, getSizeForZoom } from '../../hooks/useImageLoader';
import {
  buildSortedIndex,
  getVisibleItems,
  diffVisibleItems,
  type ViewportRect,
  type SortedLayoutIndex,
} from '../../utils/viewport';
import type {
  LayoutResult,
  LayoutItem,
} from '../../utils/layout';
import type { ImageMetadata } from '../../types';
import { useCanvasStore } from '../../stores/useCanvasStore';

// ─── 常量 ─────────────────────────────────────────────

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3.0;
const ZOOM_SENSITIVITY = 0.001;
const DRAG_DEAD_ZONE = 5;
const BG_COLOR = 0xF8F9FA;

// ─── Props ────────────────────────────────────────────

export interface InfiniteCanvasProps {
  layout: LayoutResult;
  /** hash → 文件名 */
  fileNames: Map<string, string>;
  /** hash → ImageMetadata */
  metadataMap: Map<string, ImageMetadata>;
}

// ─── Component ────────────────────────────────────────

export default function InfiniteCanvas({
  layout,
  fileNames,
  metadataMap,
}: InfiniteCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const contentLayerRef = useRef<Container | null>(null);
  const bgLayerRef = useRef<DotBackground | null>(null);
  const imageLoaderRef = useRef<ImageLoader | null>(null);
  const sortedIndexRef = useRef<SortedLayoutIndex | null>(null);
  const visibleItemsRef = useRef<LayoutItem[]>([]);
  const canvasItemsRef = useRef<Map<string, CanvasImageItem>>(new Map());
  const zoomLevelRef = useRef(1.0);
  const prevZoomSizeRef = useRef<string>('medium');

  // ── Drag state ──
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const contentStartRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);

  // Store sync
  const setZoom = useCanvasStore((s) => s.setZoom);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const setViewportRect = useCanvasStore((s) => s.setViewportRect);

  // ── 视口更新 ──
  const updateViewport = useCallback(() => {
    const app = appRef.current;
    const contentLayer = contentLayerRef.current;
    if (!app || !contentLayer) return;

    const scale = contentLayer.scale.x;
    const viewport: ViewportRect = {
      x: -contentLayer.x / scale,
      y: -contentLayer.y / scale,
      width: app.screen.width / scale,
      height: app.screen.height / scale,
    };

    // 同步到 store
    setViewport(-contentLayer.x / scale, -contentLayer.y / scale);
    setViewportRect(viewport);

    // 视口裁剪
    const index = sortedIndexRef.current;
    if (!index) return;

    const newVisible = getVisibleItems(index, viewport);
    const prevVisible = visibleItemsRef.current;
    const diff = diffVisibleItems(prevVisible, newVisible);

    // 处理离开视口的元素
    for (const item of diff.leave) {
      const canvasItem = canvasItemsRef.current.get(item.hash);
      if (canvasItem) {
        contentLayer.removeChild(canvasItem);
        canvasItem.destroy();
        canvasItemsRef.current.delete(item.hash);
      }
    }

    // 处理进入视口的元素
    const imageLoader = imageLoaderRef.current;
    for (const item of diff.enter) {
      if (canvasItemsRef.current.has(item.hash)) continue;

      const canvasItem = new CanvasImageItem(item);
      const fileName = fileNames.get(item.hash) ?? item.hash;
      const meta = metadataMap.get(item.hash);
      canvasItem.setImageInfo(fileName, meta);
      canvasItem.updateZoomVisibility(zoomLevelRef.current);

      contentLayer.addChild(canvasItem);
      canvasItemsRef.current.set(item.hash, canvasItem);

      // 异步加载纹理
      if (imageLoader) {
        imageLoader
          .loadTexture(item.hash, zoomLevelRef.current)
          .then((texture) => {
            if (texture && canvasItemsRef.current.has(item.hash)) {
              canvasItemsRef.current.get(item.hash)!.setTexture(texture);
            }
          });
      }
    }

    visibleItemsRef.current = newVisible;
  }, [fileNames, metadataMap, setViewport, setViewportRect]);

  // ── 缩放阈值切换 ──
  const handleZoomThresholdChange = useCallback(
    (newZoom: number) => {
      const newSize = getSizeForZoom(newZoom);
      if (newSize === prevZoomSizeRef.current) return;
      prevZoomSizeRef.current = newSize;

      const imageLoader = imageLoaderRef.current;
      if (!imageLoader) return;

      // 重新加载视口内所有图片
      const visibleHashes = visibleItemsRef.current.map((i) => i.hash);
      imageLoader.reloadForZoomChange(
        visibleHashes,
        newZoom,
        (hash, texture) => {
          const canvasItem = canvasItemsRef.current.get(hash);
          if (canvasItem) {
            canvasItem.setTexture(texture);
          }
        },
      );
    },
    [],
  );

  // ── 初始化 PixiJS ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;
    const app = new Application();

    const initApp = async () => {
      await app.init({
        background: BG_COLOR,
        resizeTo: container,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });

      if (destroyed) {
        app.destroy(true);
        return;
      }

      container.appendChild(app.canvas as HTMLCanvasElement);
      appRef.current = app;

      // ── 背景层 ──
      const bgLayer = new DotBackground();
      await bgLayer.init(app);
      app.stage.addChild(bgLayer);
      bgLayerRef.current = bgLayer;

      // ── 内容层 ──
      const contentLayer = new Container();
      app.stage.addChild(contentLayer);
      contentLayerRef.current = contentLayer;

      // ── 图片加载器 ──
      imageLoaderRef.current = new ImageLoader(300);

      // ── 排序索引 ──
      sortedIndexRef.current = buildSortedIndex(layout.items);

      // ── 添加分组标题 ──
      for (const titleItem of layout.groupTitles) {
        const title = new GroupTitle(titleItem);
        contentLayer.addChild(title);
      }

      // ── 滚轮缩放 ──
      app.canvas.addEventListener('wheel', handleWheel, { passive: false });

      // ── 拖拽平移 ──
      app.canvas.addEventListener('pointerdown', handlePointerDown);
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);

      // ── Resize ──
      const resizeObserver = new ResizeObserver(() => {
        bgLayer.resize(app.screen.width, app.screen.height);
        updateViewport();
      });
      resizeObserver.observe(container);

      // 初始视口更新
      updateViewport();
    };

    // ── 事件处理器 ──

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const contentLayer = contentLayerRef.current;
      if (!contentLayer) return;

      const oldZoom = zoomLevelRef.current;
      const delta = -e.deltaY * ZOOM_SENSITIVITY;
      const newZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, oldZoom * (1 + delta)),
      );

      if (newZoom === oldZoom) return;

      // 锚点缩放：鼠标位置不变
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // 计算鼠标在内容坐标系中的位置
      const contentMouseX = (mouseX - contentLayer.x) / oldZoom;
      const contentMouseY = (mouseY - contentLayer.y) / oldZoom;

      // 应用新缩放
      contentLayer.scale.set(newZoom);

      // 调整位置保持锚点不变
      contentLayer.x = mouseX - contentMouseX * newZoom;
      contentLayer.y = mouseY - contentMouseY * newZoom;

      zoomLevelRef.current = newZoom;
      setZoom(newZoom);

      // 更新覆盖层可见性
      for (const item of canvasItemsRef.current.values()) {
        item.updateZoomVisibility(newZoom);
      }

      handleZoomThresholdChange(newZoom);
      updateViewport();
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // 仅左键
      isDraggingRef.current = true;
      hasDraggedRef.current = false;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      const contentLayer = contentLayerRef.current;
      if (contentLayer) {
        contentStartRef.current = { x: contentLayer.x, y: contentLayer.y };
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const contentLayer = contentLayerRef.current;
      if (!contentLayer) return;

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      // 死区
      if (!hasDraggedRef.current) {
        if (Math.abs(dx) < DRAG_DEAD_ZONE && Math.abs(dy) < DRAG_DEAD_ZONE) {
          return;
        }
        hasDraggedRef.current = true;
      }

      contentLayer.x = contentStartRef.current.x + dx;
      contentLayer.y = contentStartRef.current.y + dy;
      updateViewport();
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
    };

    initApp();

    return () => {
      destroyed = true;
      const canvas = appRef.current?.canvas;
      if (canvas) {
        canvas.removeEventListener('wheel', handleWheel);
        canvas.removeEventListener('pointerdown', handlePointerDown);
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);

      // 清理画布项
      for (const item of canvasItemsRef.current.values()) {
        item.destroy();
      }
      canvasItemsRef.current.clear();

      imageLoaderRef.current?.destroy();
      appRef.current?.destroy(true);
      appRef.current = null;
    };
  }, [layout, updateViewport, setZoom, handleZoomThresholdChange]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    />
  );
}
