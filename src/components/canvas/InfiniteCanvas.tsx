// ============================================================
// 无限画布 (InfiniteCanvas) — 水平分组滑动模式
//
// React 组件，管理 PixiJS Application 生命周期。
// 内部通过命令式 API 控制 PixiJS 对象，不使用 @pixi/react。
//
// 层级结构:
// Stage
// ├── BackgroundLayer (DotBackground) — 固定视口坐标
// └── ContentLayer (Container) — 可缩放/平移
//     └── CanvasImageItem × N (由虚拟化引擎管理)
//
// 交互模式:
// - 鼠标滚轮 → 组内纵向滚动（锁定当前分组范围）
// - 左右键 / 底部进度条 → 水平切换分组（带动画）
// - 点击 → 选中/取消图片（仅当前组）
// - Ctrl+滚轮 → 缩放
// ============================================================

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Application, Container } from 'pixi.js';
import { DotBackground } from './DotBackground';
import { CanvasImageItem } from './CanvasImageItem';
import { ImageLoader, getSizeForDisplay } from '../../hooks/useImageLoader';
import {
  getVisibleItems,
  diffVisibleItems,
  type ViewportRect,
} from '../../utils/viewport';
import type {
  LayoutResult,
  LayoutItem,
} from '../../utils/layout';
import type { ImageMetadata } from '../../types';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useSelectionStore } from '../../stores/useSelectionStore';
import { useThemeStore } from '../../stores/useThemeStore';

// ─── 常量 ─────────────────────────────────────────────

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3.0;
const ZOOM_SENSITIVITY = 0.001;
const DRAG_DEAD_ZONE = 5;
const BG_COLOR_LIGHT = 0xFAFAFA;
const BG_COLOR_DARK = 0x0F0F0F;
const GROUP_TRANSITION_MS =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 0
    : 400;

// ─── Props ────────────────────────────────────────────

export interface InfiniteCanvasProps {
  layout: LayoutResult;
  /** hash → 文件名 */
  fileNames: Map<string, string>;
  /** hash → ImageMetadata */
  metadataMap: Map<string, ImageMetadata>;
}

// ─── Handle ───────────────────────────────────────────

export interface InfiniteCanvasHandle {
  /** 将 SelectionStore 状态同步到所有可见 CanvasImageItem */
  syncSelectionVisuals: () => void;
  /** 将画布视口滚动到指定 Y 坐标 */
  scrollToY: (y: number) => void;
}

// ─── Component ────────────────────────────────────────

const InfiniteCanvas = forwardRef<InfiniteCanvasHandle, InfiniteCanvasProps>(function InfiniteCanvas({
  layout,
  fileNames,
  metadataMap,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const contentLayerRef = useRef<Container | null>(null);
  const bgLayerRef = useRef<DotBackground | null>(null);
  const imageLoaderRef = useRef<ImageLoader | null>(null);
  const visibleItemsRef = useRef<LayoutItem[]>([]);
  const canvasItemsRef = useRef<Map<string, CanvasImageItem>>(new Map());
  const zoomLevelRef = useRef(1.0);
  /** 上次质量判断对应的 size（基于 displayWidth） */
  const prevSizeRef = useRef<string>('medium');

  // ── 选中状态同步 fn ref（在 effect 内赋值） ──
  const syncSelectionVisualsRef = useRef<(() => void) | null>(null);

  // ── Drag state ──
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const contentStartRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);

  // ── 水平分组滑动状态 ──
  const scrollYRef = useRef(0);
  const transitionAnimRef = useRef<number | null>(null);
  /** 动画开始前的分组索引 */
  const prevGroupIndexRef = useRef(0);

  // ── wheel 事件 throttle ──
  const lastWheelUpdateTimeRef = useRef<number>(0);
  const WHEEL_THROTTLE_MS = 16; // ~60fps

  // Store sync
  const storeZoomLevel = useCanvasStore((s) => s.zoomLevel);
  const fitCounter = useCanvasStore((s) => s.fitCounter);
  const currentGroupIndex = useCanvasStore((s) => s.currentGroupIndex);
  const isTransitioning = useCanvasStore((s) => s.isTransitioning);
  const setZoom = useCanvasStore((s) => s.setZoom);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const setViewportRect = useCanvasStore((s) => s.setViewportRect);
  const setTransitioning = useCanvasStore((s) => s.setTransitioning);

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

    setViewport(-contentLayer.x / scale, -contentLayer.y / scale);
    setViewportRect(viewport);

    if (!layout.pages || layout.pages.length === 0) return;

    const newVisible = getVisibleItems(
      layout.pages,
      layout.pageWidth,
      viewport,
    );
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
    const activeGroupIdx = useCanvasStore.getState().currentGroupIndex;
    const transitioning = useCanvasStore.getState().isTransitioning;

    for (const item of diff.enter) {
      if (canvasItemsRef.current.has(item.hash)) continue;

      const canvasItem = new CanvasImageItem(item);
      const fileName = fileNames.get(item.hash) ?? item.hash;
      const meta = metadataMap.get(item.hash);
      canvasItem.setImageInfo(fileName, meta);
      canvasItem.updateZoomVisibility(zoomLevelRef.current);

      const { selectedHashes } = useSelectionStore.getState();
      canvasItem.setSelected(selectedHashes.has(item.hash));

      // 非当前组的图片默认隐藏，切组动画中会渐现
      if (!transitioning) {
        canvasItem.alpha = item.groupIndex === activeGroupIdx ? 1 : 0;
      }

      contentLayer.addChild(canvasItem);
      canvasItemsRef.current.set(item.hash, canvasItem);

      if (imageLoader) {
        imageLoader
          .loadTexture(item.hash, item.width * zoomLevelRef.current)
          .then((texture) => {
            if (texture && canvasItemsRef.current.has(item.hash)) {
              canvasItemsRef.current.get(item.hash)!.setTexture(texture);
            }
          });
      }
    }

    visibleItemsRef.current = newVisible;
  }, [layout, fileNames, metadataMap, setViewport, setViewportRect]);

  // ── 缩放阈值切换 ──
  const handleZoomThresholdChange = useCallback(
    (newZoom: number) => {
      const visibleItems = visibleItemsRef.current;
      if (visibleItems.length === 0) return;

      // 在等宽列布局下所有图片宽度相同，取第一个即可
      const representativeWidth = visibleItems[0].width;
      const displayWidth = representativeWidth * newZoom;
      const newSize = getSizeForDisplay(displayWidth);
      if (newSize === prevSizeRef.current) return;
      prevSizeRef.current = newSize;

      const imageLoader = imageLoaderRef.current;
      if (!imageLoader) return;

      const entries = visibleItems.map((item) => ({
        hash: item.hash,
        displayWidth: item.width * newZoom,
      }));
      imageLoader.reloadForZoomChange(
        entries,
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

  // ── 设置所有可见 item 的 alpha（根据所属分组） ──
  const applyGroupAlpha = useCallback((activeGroupIdx: number, prevGroupIdx: number, t: number) => {
    for (const [, canvasItem] of canvasItemsRef.current) {
      const layoutItem = visibleItemsRef.current.find(li => li.hash === canvasItem.hash);
      if (!layoutItem) continue;

      if (layoutItem.groupIndex === activeGroupIdx) {
        canvasItem.alpha = t;
      } else if (layoutItem.groupIndex === prevGroupIdx) {
        canvasItem.alpha = 1 - t;
      } else {
        canvasItem.alpha = 0;
      }
    }
  }, []);

  /** 确保只有指定组可见 */
  const ensureOnlyGroupVisible = useCallback((groupIndex: number) => {
    for (const [, ci] of canvasItemsRef.current) {
      const li = visibleItemsRef.current.find(l => l.hash === ci.hash);
      ci.alpha = li && li.groupIndex === groupIndex ? 1 : 0;
    }
  }, []);

  // ── 计算当前组的垂直居中偏移 ──
  const computeVerticalOffset = useCallback((groupIndex: number, zoom: number) => {
    const app = appRef.current;
    if (!app || !layout.pages[groupIndex]) return 0;

    const page = layout.pages[groupIndex];
    const screenHeight = app.screen.height;
    const contentHeight = page.contentHeight * zoom;

    // 内容比视口矮时，向下偏移使其居中
    if (contentHeight < screenHeight) {
      return (screenHeight - contentHeight) / 2;
    }
    return 0;
  }, [layout]);

  // ── 计算当前组的 X 坐标（内容中心对齐窗口中心） ──
  const computeGroupX = useCallback((groupIndex: number, zoom: number) => {
    const app = appRef.current;
    if (!app) return -(groupIndex * layout.pageWidth * zoom);

    const screenWidth = app.screen.width;
    // 页面中心（内容坐标系）= (groupIndex + 0.5) * pageWidth
    // 映射到屏幕中心
    return screenWidth / 2 - (groupIndex + 0.5) * layout.pageWidth * zoom;
  }, [layout]);

  // ── 定位到当前分组（设置 ContentLayer 位置） ──
  const positionToGroup = useCallback((groupIndex: number, animated: boolean) => {
    const contentLayer = contentLayerRef.current;
    const app = appRef.current;
    if (!contentLayer || !app) return;
    if (!layout.pages || layout.pages.length === 0) return;

    const zoom = zoomLevelRef.current;
    const targetX = computeGroupX(groupIndex, zoom);
    const verticalOffset = computeVerticalOffset(groupIndex, zoom);
    const targetY = verticalOffset;
    scrollYRef.current = 0;

    if (!animated) {
      contentLayer.x = targetX;
      contentLayer.y = targetY;
      setTransitioning(false);
      updateViewport();
      ensureOnlyGroupVisible(groupIndex);
      prevGroupIndexRef.current = groupIndex;
      return;
    }

    if (transitionAnimRef.current != null) {
      cancelAnimationFrame(transitionAnimRef.current);
    }

    const startX = contentLayer.x;
    const startY = contentLayer.y;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / GROUP_TRANSITION_MS, 1);
      const eased = 1 - Math.pow(1 - progress, 4);

      contentLayer.x = startX + (targetX - startX) * eased;
      contentLayer.y = startY + (targetY - startY) * eased;

      applyGroupAlpha(groupIndex, prevGroupIndexRef.current, eased);
      updateViewport();

      if (progress < 1) {
        transitionAnimRef.current = requestAnimationFrame(animate);
      } else {
        transitionAnimRef.current = null;
        setTransitioning(false);
        prevGroupIndexRef.current = groupIndex;
        ensureOnlyGroupVisible(groupIndex);
      }
    };

    transitionAnimRef.current = requestAnimationFrame(animate);
  }, [layout, updateViewport, setTransitioning, applyGroupAlpha, ensureOnlyGroupVisible, computeVerticalOffset, computeGroupX]);

  // ── 初始化 PixiJS ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;
    const app = new Application();

    const initApp = async () => {
      const theme = useThemeStore.getState().theme;
      const bgColor = theme === 'light' ? BG_COLOR_LIGHT : BG_COLOR_DARK;

      await app.init({
        background: bgColor,
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
      bgLayer.updateTheme(theme);
      app.stage.addChild(bgLayer);
      bgLayerRef.current = bgLayer;

      // ── 内容层 ──
      const contentLayer = new Container();
      app.stage.addChild(contentLayer);
      contentLayerRef.current = contentLayer;

      // ── 图片加载器 ──
      imageLoaderRef.current = new ImageLoader(300);

      // ── 设置分组总数 ──
      useCanvasStore.getState().setGroupCount(layout.pages.length);

      // ── 滚轮事件 ──
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

      // 初始定位到第一组
      positionToGroup(useCanvasStore.getState().currentGroupIndex, false);
    };

    // ── 事件处理器 ──

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const contentLayer = contentLayerRef.current;
      if (!contentLayer || !appRef.current) return;

      if (useCanvasStore.getState().isTransitioning) return;

      if (e.ctrlKey || e.metaKey) {
        // ── Ctrl+滚轮：缩放（锁定当前组位置） ──
        const oldZoom = zoomLevelRef.current;
        const delta = -e.deltaY * ZOOM_SENSITIVITY;
        const newZoom = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, oldZoom * (1 + delta)),
        );
        if (newZoom === oldZoom) return;

        // 鼠标锚点缩放：仅在 Y 轴上以鼠标位置为锚点
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        const mouseY = e.clientY - rect.top;
        const contentMouseY = (mouseY - contentLayer.y) / oldZoom;

        contentLayer.scale.set(newZoom);

        // X 轴：内容中心对齐窗口中心
        const { currentGroupIndex } = useCanvasStore.getState();
        contentLayer.x = computeGroupX(currentGroupIndex, newZoom);

        // Y 轴：以鼠标位置为锚点缩放，并 clamp 到合法范围
        const page = layout.pages[currentGroupIndex];
        const screenHeight = appRef.current!.screen.height;
        const maxScrollY = page ? Math.max(0, page.contentHeight - screenHeight / newZoom) : 0;
        const newContentY = mouseY - contentMouseY * newZoom;
        const vertOffset = computeVerticalOffset(currentGroupIndex, newZoom);

        // 从 contentLayer.y 反推 scrollY
        const rawScrollY = -(newContentY - vertOffset) / newZoom;
        scrollYRef.current = Math.max(0, Math.min(maxScrollY, rawScrollY));
        contentLayer.y = -scrollYRef.current * newZoom + vertOffset;

        zoomLevelRef.current = newZoom;
        setZoom(newZoom);

        for (const item of canvasItemsRef.current.values()) {
          item.updateZoomVisibility(newZoom);
        }

        handleZoomThresholdChange(newZoom);
        // throttle updateViewport 调用
        const now = performance.now();
        if (now - lastWheelUpdateTimeRef.current >= WHEEL_THROTTLE_MS) {
          updateViewport();
          lastWheelUpdateTimeRef.current = now;
        }
      } else {
        // ── 普通滚轮：组内纵向滚动（锁定范围） ──
        const { currentGroupIndex } = useCanvasStore.getState();
        const page = layout.pages[currentGroupIndex];
        if (!page) return;

        const zoom = zoomLevelRef.current;
        const screenHeight = appRef.current.screen.height;
        const maxScrollY = Math.max(0, page.contentHeight - screenHeight / zoom);

        scrollYRef.current = Math.max(0, Math.min(maxScrollY, scrollYRef.current + e.deltaY / zoom));

        const vertOffset = computeVerticalOffset(currentGroupIndex, zoom);
        contentLayer.y = -scrollYRef.current * zoom + vertOffset;
        contentLayer.x = computeGroupX(currentGroupIndex, zoom);

        // throttle updateViewport 调用
        const now = performance.now();
        if (now - lastWheelUpdateTimeRef.current >= WHEEL_THROTTLE_MS) {
          updateViewport();
          lastWheelUpdateTimeRef.current = now;
        }
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
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
      if (!contentLayer || !appRef.current) return;

      if (useCanvasStore.getState().isTransitioning) return;

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

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

    const handlePointerUp = (e: PointerEvent) => {
      const wasDragging = isDraggingRef.current;
      isDraggingRef.current = false;

      if (wasDragging && !hasDraggedRef.current) {
        handleCanvasClick(e);
      } else if (wasDragging && hasDraggedRef.current) {
        // 从 contentLayer.y 反推 scrollY
        const contentLayer = contentLayerRef.current;
        if (contentLayer) {
          const zoom = zoomLevelRef.current;
          const { currentGroupIndex } = useCanvasStore.getState();
          const vertOffset = computeVerticalOffset(currentGroupIndex, zoom);
          scrollYRef.current = -(contentLayer.y - vertOffset) / zoom;
        }
      }
    };

    /** 处理画布点击：命中检测 → 切换选中（仅当前组） */
    const handleCanvasClick = (e: PointerEvent) => {
      const contentLayer = contentLayerRef.current;
      if (!contentLayer) return;

      const activeGroupIdx = useCanvasStore.getState().currentGroupIndex;

      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const zoom = zoomLevelRef.current;
      const contentX = (screenX - contentLayer.x) / zoom;
      const contentY = (screenY - contentLayer.y) / zoom;

      for (const [hash, item] of canvasItemsRef.current) {
        // 只对当前组的可见图片做命中检测
        if (item.alpha <= 0) continue;
        const layoutItem = visibleItemsRef.current.find(li => li.hash === hash);
        if (!layoutItem || layoutItem.groupIndex !== activeGroupIdx) continue;

        const lx = item.x;
        const ly = item.y;
        const bounds = item.getBounds();
        const w = bounds.width / zoom;
        const h = bounds.height / zoom;

        if (
          contentX >= lx &&
          contentX <= lx + w &&
          contentY >= ly &&
          contentY <= ly + h
        ) {
          useSelectionStore.getState().toggleSelection(hash);
          syncSelectionVisuals();
          return;
        }
      }
    };

    /** 将 SelectionStore 状态同步到所有可见 CanvasImageItem */
    const syncSelectionVisuals = () => {
      const { selectedHashes } = useSelectionStore.getState();
      for (const [hash, item] of canvasItemsRef.current) {
        item.setSelected(selectedHashes.has(hash));
      }
    };

    syncSelectionVisualsRef.current = syncSelectionVisuals;

    initApp();

    return () => {
      destroyed = true;
      if (transitionAnimRef.current != null) {
        cancelAnimationFrame(transitionAnimRef.current);
      }
      const canvas = appRef.current?.canvas;
      if (canvas) {
        canvas.removeEventListener('wheel', handleWheel);
        canvas.removeEventListener('pointerdown', handlePointerDown);
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);

      for (const item of canvasItemsRef.current.values()) {
        item.destroy();
      }
      canvasItemsRef.current.clear();

      imageLoaderRef.current?.destroy();
      appRef.current?.destroy(true);
      appRef.current = null;
    };
  }, [layout, updateViewport, setZoom, handleZoomThresholdChange, positionToGroup]);

  // ── 监听 currentGroupIndex 变化 → 带动画切换 ──
  useEffect(() => {
    if (isTransitioning) {
      positionToGroup(currentGroupIndex, true);
    }
  }, [currentGroupIndex, isTransitioning, positionToGroup]);

  // ── 暴露 handle ──
  useImperativeHandle(ref, () => ({
    syncSelectionVisuals: () => {
      syncSelectionVisualsRef.current?.();
    },
    scrollToY: (y: number) => {
      const contentLayer = contentLayerRef.current;
      if (!contentLayer) return;
      const zoom = zoomLevelRef.current;
      scrollYRef.current = y;
      contentLayer.y = -y * zoom;
      updateViewport();
    },
  }), [updateViewport]);

  // ── 外部缩放同步 ──
  useEffect(() => {
    const contentLayer = contentLayerRef.current;
    const app = appRef.current;
    if (!contentLayer || !app) return;

    if (Math.abs(storeZoomLevel - zoomLevelRef.current) < 0.001) return;

    const newZoom = storeZoomLevel;
    const { currentGroupIndex } = useCanvasStore.getState();

    contentLayer.scale.set(newZoom);

    // X：内容中心对齐窗口中心
    contentLayer.x = computeGroupX(currentGroupIndex, newZoom);

    // Y: 保持 scrollY 不变，重新计算居中偏移
    const page = layout.pages[currentGroupIndex];
    const screenHeight = app.screen.height;
    const maxScrollY = page ? Math.max(0, page.contentHeight - screenHeight / newZoom) : 0;
    scrollYRef.current = Math.min(scrollYRef.current, maxScrollY);
    const vertOffset = computeVerticalOffset(currentGroupIndex, newZoom);
    contentLayer.y = -scrollYRef.current * newZoom + vertOffset;

    zoomLevelRef.current = newZoom;

    for (const item of canvasItemsRef.current.values()) {
      item.updateZoomVisibility(newZoom);
    }

    handleZoomThresholdChange(newZoom);
    updateViewport();
  }, [storeZoomLevel, layout, handleZoomThresholdChange, updateViewport, computeVerticalOffset, computeGroupX]);

  // ── fitToWindow ──
  useEffect(() => {
    if (fitCounter === 0) return;

    const contentLayer = contentLayerRef.current;
    const app = appRef.current;
    if (!contentLayer || !app) return;

    const { currentGroupIndex } = useCanvasStore.getState();
    const page = layout.pages[currentGroupIndex];

    // 根据视口和内容尺寸计算适应窗口的缩放比例
    const FIT_PADDING = 40; // px 留白
    const screenWidth = app.screen.width;
    const screenHeight = app.screen.height;
    const effectiveWidth = screenWidth - FIT_PADDING * 2;
    const effectiveHeight = screenHeight - FIT_PADDING * 2;

    let newZoom = 1.0;
    if (page && layout.pageWidth > 0 && page.contentHeight > 0) {
      const zoomX = effectiveWidth / layout.pageWidth;
      const zoomY = effectiveHeight / page.contentHeight;
      newZoom = Math.max(MIN_ZOOM, Math.min(Math.min(zoomX, zoomY), MAX_ZOOM));
    }

    contentLayer.scale.set(newZoom);
    zoomLevelRef.current = newZoom;
    scrollYRef.current = 0;
    setZoom(newZoom);

    contentLayer.x = computeGroupX(currentGroupIndex, newZoom);
    contentLayer.y = computeVerticalOffset(currentGroupIndex, newZoom);

    for (const item of canvasItemsRef.current.values()) {
      item.updateZoomVisibility(newZoom);
    }

    handleZoomThresholdChange(newZoom);
    updateViewport();
  }, [fitCounter, layout, handleZoomThresholdChange, updateViewport, computeVerticalOffset, computeGroupX, setZoom]);

  // ── 选中数量播报（屏幕阅读器） ──
  const selectedCount = useSelectionStore((s) => s.selectedCount);
  const themeValue = useThemeStore((s) => s.theme);

  // 订阅主题变化
  useEffect(() => {
    const app = appRef.current;
    const bgLayer = bgLayerRef.current;
    if (!app || !bgLayer) return;

    const bgColor = themeValue === 'light' ? BG_COLOR_LIGHT : BG_COLOR_DARK;
    app.renderer.background.color = bgColor;
    bgLayer.updateTheme(themeValue);
  }, [themeValue]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="图片分组展示画布"
      aria-roledescription="无限画布"
      tabIndex={0}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* 屏幕阅读器播报区：选中变化 */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}
      >
        {selectedCount > 0
          ? `已选中 ${selectedCount} 张图片`
          : '未选中图片'}
      </div>
    </div>
  );
});

export default InfiniteCanvas;
