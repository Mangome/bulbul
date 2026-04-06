// ============================================================
// 无限画布 (InfiniteCanvas) — Canvas 2D 渲染引擎
//
// React 组件，管理原生 HTMLCanvasElement 生命周期。
// 使用 dirty flag + requestAnimationFrame 按需渲染。
//
// 绘制顺序:
// 1. 清空 Canvas + 背景色
// 2. DotBackground（固定视口坐标）
// 3. ctx.save/translate/scale → 内容坐标系
//    3a. drawGroupTitles
//    3b. CanvasImageItem.draw() × N
// 4. ctx.restore
//
// 交互模式:
// - 鼠标滚轮 → 组内纵向滚动（锁定当前分组范围）
// - 左右键 / 底部进度条 → 水平切换分组（带动画）
// - 点击 → 选中/取消图片（仅当前组）
// - Ctrl+滚轮 → 缩放
// ============================================================

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { DotBackground } from './DotBackground';
import { CanvasImageItem } from './CanvasImageItem';
import { drawGroupTitles } from './GroupTitle';
import { ImageLoader, getSizeForDisplay } from '../../hooks/useImageLoader';
import {
  getVisibleItems,
  diffVisibleItems,
  type ViewportRect,
} from '../../utils/viewport';
import {
  DEFAULT_LAYOUT_CONFIG,
  type LayoutResult,
  type LayoutItem,
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
const BG_COLOR_LIGHT = '#FFFFFF';
const BG_COLOR_DARK = '#0A0E1A';
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
  /** 更新指定 hash 的 item 元数据（合焦评分逐张到达时调用） */
  updateItemMetadata: (hash: string) => void;
}

// ─── Component ────────────────────────────────────────

const InfiniteCanvas = forwardRef<InfiniteCanvasHandle, InfiniteCanvasProps>(function InfiniteCanvas({
  layout,
  fileNames,
  metadataMap,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const bgLayerRef = useRef<DotBackground | null>(null);
  const imageLoaderRef = useRef<ImageLoader | null>(null);
  const visibleItemsRef = useRef<LayoutItem[]>([]);
  const canvasItemsRef = useRef<Map<string, CanvasImageItem>>(new Map());
  const zoomLevelRef = useRef(1.0);

  // Canvas 尺寸（CSS 像素）
  const screenWidthRef = useRef(0);
  const screenHeightRef = useRef(0);
  const dprRef = useRef(1);

  // Dirty flag + rAF
  const dirtyRef = useRef(true);
  const rafIdRef = useRef(0);
  const destroyedRef = useRef(false);

  /** 上次质量判断对应的 size（基于 displayWidth） */
  const prevSizeRef = useRef<string>('medium');

  // ── 选中状态同步 fn ref（在 effect 内赋值） ──
  const syncSelectionVisualsRef = useRef<(() => void) | null>(null);

  // ── 用 ref 持有最新的 fileNames / metadataMap ──
  const fileNamesRef = useRef(fileNames);
  fileNamesRef.current = fileNames;
  const metadataMapRef = useRef(metadataMap);
  metadataMapRef.current = metadataMap;

  // ── 用 ref 持有最新的 layout ──
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  // ── 坐标变换状态（替代 PixiJS contentLayer） ──
  const offsetXRef = useRef(0);
  const offsetYRef = useRef(0);
  const actualZoomRef = useRef(1.0);

  // ── Drag state ──
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);

  // ── 水平分组滑动状态 ──
  const scrollYRef = useRef(0);
  const transitionAnimRef = useRef<number | null>(null);
  const prevGroupIndexRef = useRef(0);

  // ── 悬停状态 ──
  const hoveredHashRef = useRef<string | null>(null);

  // ── wheel 事件 throttle ──
  const lastWheelUpdateTimeRef = useRef<number>(0);
  const WHEEL_THROTTLE_MS = 16;

  // Store sync
  const storeZoomLevel = useCanvasStore((s) => s.zoomLevel);
  const fitCounter = useCanvasStore((s) => s.fitCounter);
  const currentGroupIndex = useCanvasStore((s) => s.currentGroupIndex);
  const isTransitioning = useCanvasStore((s) => s.isTransitioning);
  const setZoom = useCanvasStore((s) => s.setZoom);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const setViewportRect = useCanvasStore((s) => s.setViewportRect);
  const setTransitioning = useCanvasStore((s) => s.setTransitioning);

  // ─── Canvas 初始化与 DPR ──────────────────────────────

  /** 设置 Canvas 物理分辨率 + DPR */
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return null;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(dpr, dpr);

    screenWidthRef.current = w;
    screenHeightRef.current = h;
    dprRef.current = dpr;
    ctxRef.current = ctx;

    return ctx;
  }, []);

  // ─── Dirty Flag 机制 ──────────────────────────────────

  const markDirty = useCallback(() => {
    if (destroyedRef.current) return;
    if (dirtyRef.current) return;
    dirtyRef.current = true;
    cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(renderFrame);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 缩放补偿 ────────────────────────────────────────

  const getZoomCompensation = useCallback((groupIndex: number): number => {
    const currentLayout = layoutRef.current;
    const page = currentLayout.pages[groupIndex];
    if (!page || !currentLayout.baseColumnWidth || !page.columnWidth) return 1.0;
    return currentLayout.baseColumnWidth / page.columnWidth;
  }, []);

  const getActualZoom = useCallback((groupIndex: number): number => {
    return zoomLevelRef.current * getZoomCompensation(groupIndex);
  }, [getZoomCompensation]);

  // ─── 坐标计算 ────────────────────────────────────────

  const computeVerticalOffset = useCallback((groupIndex: number, zoom: number): number => {
    const currentLayout = layoutRef.current;
    if (!currentLayout.pages[groupIndex]) return 0;

    const page = currentLayout.pages[groupIndex];
    const screenHeight = screenHeightRef.current;
    const { paddingTop, paddingBottom } = DEFAULT_LAYOUT_CONFIG;
    const pureContentHeight = (page.contentHeight - paddingTop - paddingBottom) * zoom;

    if (pureContentHeight < screenHeight) {
      return (screenHeight - pureContentHeight) / 2 - paddingTop * zoom;
    }
    return 0;
  }, []);

  const computeGroupX = useCallback((groupIndex: number, zoom: number): number => {
    const currentLayout = layoutRef.current;
    const screenWidth = screenWidthRef.current;
    if (screenWidth === 0) return -(groupIndex * currentLayout.pageWidth * zoom);
    return screenWidth / 2 - (groupIndex + 0.5) * currentLayout.pageWidth * zoom;
  }, []);

  // ─── 视口更新 ────────────────────────────────────────

  const updateViewport = useCallback(() => {
    const az = actualZoomRef.current;
    if (az === 0) return;

    const viewport: ViewportRect = {
      x: -offsetXRef.current / az,
      y: -offsetYRef.current / az,
      width: screenWidthRef.current / az,
      height: screenHeightRef.current / az,
    };

    setViewport(-offsetXRef.current / az, -offsetYRef.current / az);
    setViewportRect(viewport);

    const currentLayout = layoutRef.current;
    if (!currentLayout.pages || currentLayout.pages.length === 0) return;

    const newVisible = getVisibleItems(
      currentLayout.pages,
      currentLayout.pageWidth,
      viewport,
    );
    const prevVisible = visibleItemsRef.current;
    const diff = diffVisibleItems(prevVisible, newVisible);

    // 处理离开视口的元素
    for (const item of diff.leave) {
      const canvasItem = canvasItemsRef.current.get(item.hash);
      if (canvasItem) {
        canvasItem.destroy();
        canvasItemsRef.current.delete(item.hash);
        imageLoaderRef.current?.evictImage(item.hash);
      }
    }

    // 处理进入视口的元素
    const imageLoader = imageLoaderRef.current;
    const activeGroupIdx = useCanvasStore.getState().currentGroupIndex;
    const transitioning = useCanvasStore.getState().isTransitioning;

    const calcActualZoom = (groupIndex: number): number => {
      const page = currentLayout.pages[groupIndex];
      if (!page || !currentLayout.baseColumnWidth || !page.columnWidth) {
        return zoomLevelRef.current;
      }
      return zoomLevelRef.current * (currentLayout.baseColumnWidth / page.columnWidth);
    };

    for (const item of diff.enter) {
      if (canvasItemsRef.current.has(item.hash)) continue;

      const canvasItem = new CanvasImageItem(item);
      const fileName = fileNamesRef.current.get(item.hash) ?? item.hash;
      const meta = metadataMapRef.current.get(item.hash);
      canvasItem.setImageInfo(fileName, meta);
      canvasItem.updateZoomVisibility(calcActualZoom(item.groupIndex));

      const { selectedHashes } = useSelectionStore.getState();
      canvasItem.setSelected(selectedHashes.has(item.hash));

      if (!transitioning) {
        canvasItem.alpha = item.groupIndex === activeGroupIdx ? 1 : 0;
      }

      canvasItemsRef.current.set(item.hash, canvasItem);

      if (imageLoader) {
        imageLoader
          .loadImage(item.hash, item.width * calcActualZoom(item.groupIndex))
          .then((result) => {
            if (!result || destroyedRef.current || !imageLoaderRef.current) return;
            if (!imageLoaderRef.current.getCache().isImageValid(result.key, result.version)) return;
            const ci = canvasItemsRef.current.get(item.hash);
            if (ci) {
              const itemMeta = metadataMapRef.current.get(item.hash);
              ci.setImage(result.image, itemMeta?.orientation ?? 1);
              markDirty();
            }
          });
      }
    }

    visibleItemsRef.current = newVisible;
  }, [setViewport, setViewportRect, markDirty]);

  // ─── 缩放阈值切换 ──────────────────────────────────────

  const handleZoomThresholdChange = useCallback(
    (newActualZoom: number) => {
      const visibleItems = visibleItemsRef.current;
      if (visibleItems.length === 0) return;

      const representativeWidth = visibleItems[0].width;
      const displayWidth = representativeWidth * newActualZoom;
      const newSize = getSizeForDisplay(displayWidth);
      if (newSize === prevSizeRef.current) return;
      prevSizeRef.current = newSize;

      const imageLoader = imageLoaderRef.current;
      if (!imageLoader) return;

      const entries = visibleItems.map((item) => ({
        hash: item.hash,
        displayWidth: item.width * newActualZoom,
      }));
      imageLoader.reloadForZoomChange(
        entries,
        (hash, result) => {
          if (destroyedRef.current || !imageLoaderRef.current) return;
          if (!imageLoaderRef.current.getCache().isImageValid(result.key, result.version)) return;
          const canvasItem = canvasItemsRef.current.get(hash);
          if (canvasItem) {
            const itemMeta = metadataMapRef.current.get(hash);
            canvasItem.setImage(result.image, itemMeta?.orientation ?? 1);
            markDirty();
          }
        },
      );
    },
    [markDirty],
  );

  // ─── 分组 alpha / 可见性 ────────────────────────────────

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

  const ensureOnlyGroupVisible = useCallback((groupIndex: number) => {
    for (const [, ci] of canvasItemsRef.current) {
      const li = visibleItemsRef.current.find(l => l.hash === ci.hash);
      ci.alpha = li && li.groupIndex === groupIndex ? 1 : 0;
    }
  }, []);

  // ─── 定位到分组 ──────────────────────────────────────

  const positionToGroup = useCallback((groupIndex: number, animated: boolean) => {
    const currentLayout = layoutRef.current;
    if (!currentLayout.pages || currentLayout.pages.length === 0) return;
    if (screenWidthRef.current === 0) return;

    const targetActualZoom = getActualZoom(groupIndex);
    const targetX = computeGroupX(groupIndex, targetActualZoom);
    const verticalOffset = computeVerticalOffset(groupIndex, targetActualZoom);
    const targetY = verticalOffset;
    scrollYRef.current = 0;

    if (!animated || GROUP_TRANSITION_MS === 0) {
      actualZoomRef.current = targetActualZoom;
      offsetXRef.current = targetX;
      offsetYRef.current = targetY;
      setTransitioning(false);
      updateViewport();
      ensureOnlyGroupVisible(groupIndex);
      prevGroupIndexRef.current = groupIndex;
      markDirty();
      return;
    }

    if (transitionAnimRef.current != null) {
      cancelAnimationFrame(transitionAnimRef.current);
    }

    const startX = offsetXRef.current;
    const startY = offsetYRef.current;
    const startScale = actualZoomRef.current;
    const startTime = performance.now();

    const animate = (now: number) => {
      if (destroyedRef.current) return;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / GROUP_TRANSITION_MS, 1);
      const eased = 1 - Math.pow(1 - progress, 4); // easeOutQuart

      actualZoomRef.current = startScale + (targetActualZoom - startScale) * eased;
      offsetXRef.current = startX + (targetX - startX) * eased;
      offsetYRef.current = startY + (targetY - startY) * eased;

      applyGroupAlpha(groupIndex, prevGroupIndexRef.current, eased);
      updateViewport();
      markDirty();

      if (progress < 1) {
        transitionAnimRef.current = requestAnimationFrame(animate);
      } else {
        transitionAnimRef.current = null;
        setTransitioning(false);
        prevGroupIndexRef.current = groupIndex;
        ensureOnlyGroupVisible(groupIndex);
        markDirty();
      }
    };

    transitionAnimRef.current = requestAnimationFrame(animate);
  }, [updateViewport, setTransitioning, applyGroupAlpha, ensureOnlyGroupVisible, computeVerticalOffset, computeGroupX, getActualZoom, markDirty]);

  // ─── 选中同步 ──────────────────────────────────────────

  const syncSelectionVisuals = useCallback(() => {
    const { selectedHashes } = useSelectionStore.getState();
    for (const [hash, item] of canvasItemsRef.current) {
      item.setSelected(selectedHashes.has(hash));
    }
    markDirty();
  }, [markDirty]);

  // ─── 渲染帧 ──────────────────────────────────────────

  // renderFrame 作为闭包定义，通过 ref 引用
  function renderFrame() {
    if (destroyedRef.current) return;
    if (!dirtyRef.current) return;
    dirtyRef.current = false;

    const ctx = ctxRef.current;
    if (!ctx) return;

    const screenW = screenWidthRef.current;
    const screenH = screenHeightRef.current;
    const dpr = dprRef.current;
    const now = performance.now();

    // 重置变换（DPR scale 已在 setupCanvas 中设置）
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. 清空 Canvas + 背景色
    const theme = useThemeStore.getState().theme;
    ctx.fillStyle = theme === 'light' ? BG_COLOR_LIGHT : BG_COLOR_DARK;
    ctx.fillRect(0, 0, screenW, screenH);

    // 2. 绘制波点背景（固定视口坐标）
    const bgLayer = bgLayerRef.current;
    if (bgLayer) {
      bgLayer.draw(ctx, screenW, screenH);
    }

    // 3. 应用内容坐标变换
    const az = actualZoomRef.current;
    const ox = offsetXRef.current;
    const oy = offsetYRef.current;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(az, az);

    // 3a. 绘制分组标题
    const currentLayout = layoutRef.current;
    if (currentLayout.groupTitles.length > 0) {
      drawGroupTitles(ctx, currentLayout.groupTitles);
    }

    // 3b. 绘制所有可见 CanvasImageItem
    let needsNextFrame = false;
    const itemsToReload: CanvasImageItem[] = [];
    for (const item of canvasItemsRef.current.values()) {
      const itemNeedsFrame = item.draw(ctx, az, now);
      needsNextFrame = needsNextFrame || itemNeedsFrame;
      if (item.needsReload) {
        itemsToReload.push(item);
      }
    }

    // 4. 恢复坐标系
    ctx.restore();

    // 5. 重新加载被 LRU 淘汰的图片
    if (itemsToReload.length > 0) {
      const imageLoader = imageLoaderRef.current;
      if (imageLoader) {
        for (const item of itemsToReload) {
          item.needsReload = false;
          imageLoader
            .loadImage(item.hash, item.getWidth() * az)
            .then((result) => {
              if (!result || destroyedRef.current || !imageLoaderRef.current) return;
              if (!imageLoaderRef.current.getCache().isImageValid(result.key, result.version)) return;
              const ci = canvasItemsRef.current.get(item.hash);
              if (ci) {
                const itemMeta = metadataMapRef.current.get(item.hash);
                ci.setImage(result.image, itemMeta?.orientation ?? 1);
                markDirty();
              }
            });
        }
      }
    }

    // 如果有动画进行中，继续请求下一帧
    if (needsNextFrame) {
      dirtyRef.current = true;
      rafIdRef.current = requestAnimationFrame(renderFrame);
    }
  }

  // ─── 初始化 useEffect ──────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    destroyedRef.current = false;

    // 初始化 Canvas 上下文
    const ctx = setupCanvas();
    if (!ctx) return;

    // 背景层
    const bgLayer = new DotBackground();
    const theme = useThemeStore.getState().theme;
    bgLayer.updateTheme(theme, ctx);
    bgLayerRef.current = bgLayer;

    // 图片加载器
    imageLoaderRef.current = new ImageLoader(50);

    // 从 store 恢复缩放
    const savedZoom = useCanvasStore.getState().zoomLevel;
    zoomLevelRef.current = savedZoom;

    // 设置分组总数
    useCanvasStore.getState().setGroupCount(layoutRef.current.pages.length);

    // 同步函数 ref
    syncSelectionVisualsRef.current = syncSelectionVisuals;

    // ── 事件处理器 ──

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (destroyedRef.current) return;
      if (useCanvasStore.getState().isTransitioning) return;

      if (e.ctrlKey || e.metaKey) {
        // Ctrl+滚轮：缩放
        const oldZoom = zoomLevelRef.current;
        const delta = -e.deltaY * ZOOM_SENSITIVITY;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * (1 + delta)));
        if (newZoom === oldZoom) return;

        const { currentGroupIndex } = useCanvasStore.getState();
        const compensation = getZoomCompensation(currentGroupIndex);
        const oldActualZoom = oldZoom * compensation;
        const newActualZoom = newZoom * compensation;

        // 鼠标锚点缩放（Y 轴）
        const rect = canvas.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;
        const contentMouseY = (mouseY - offsetYRef.current) / oldActualZoom;

        actualZoomRef.current = newActualZoom;

        // X 轴：内容中心对齐窗口中心
        offsetXRef.current = computeGroupX(currentGroupIndex, newActualZoom);

        // Y 轴：锚点缩放 + clamp
        const page = layoutRef.current.pages[currentGroupIndex];
        const screenHeight = screenHeightRef.current;
        const maxScrollY = page ? Math.max(0, page.contentHeight - screenHeight / newActualZoom) : 0;
        const newContentY = mouseY - contentMouseY * newActualZoom;
        const vertOffset = computeVerticalOffset(currentGroupIndex, newActualZoom);
        const rawScrollY = -(newContentY - vertOffset) / newActualZoom;
        scrollYRef.current = Math.max(0, Math.min(maxScrollY, rawScrollY));
        offsetYRef.current = -scrollYRef.current * newActualZoom + vertOffset;

        zoomLevelRef.current = newZoom;
        setZoom(newZoom);

        for (const item of canvasItemsRef.current.values()) {
          item.updateZoomVisibility(newActualZoom);
        }

        handleZoomThresholdChange(newActualZoom);
        const now = performance.now();
        if (now - lastWheelUpdateTimeRef.current >= WHEEL_THROTTLE_MS) {
          updateViewport();
          lastWheelUpdateTimeRef.current = now;
        }
        markDirty();
      } else {
        // 普通滚轮：组内纵向滚动
        const { currentGroupIndex } = useCanvasStore.getState();
        const page = layoutRef.current.pages[currentGroupIndex];
        if (!page) return;

        const az = getActualZoom(currentGroupIndex);
        const screenHeight = screenHeightRef.current;
        const maxScrollY = Math.max(0, page.contentHeight - screenHeight / az);

        scrollYRef.current = Math.max(0, Math.min(maxScrollY, scrollYRef.current + e.deltaY / az));

        const vertOffset = computeVerticalOffset(currentGroupIndex, az);
        offsetYRef.current = -scrollYRef.current * az + vertOffset;
        offsetXRef.current = computeGroupX(currentGroupIndex, az);
        actualZoomRef.current = az;

        const now = performance.now();
        if (now - lastWheelUpdateTimeRef.current >= WHEEL_THROTTLE_MS) {
          updateViewport();
          lastWheelUpdateTimeRef.current = now;
        }
        markDirty();
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      isDraggingRef.current = true;
      hasDraggedRef.current = false;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      offsetStartRef.current = { x: offsetXRef.current, y: offsetYRef.current };
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (isDraggingRef.current) {
        // 拖拽模式
        if (destroyedRef.current) return;
        if (useCanvasStore.getState().isTransitioning) return;

        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;

        if (!hasDraggedRef.current) {
          if (Math.abs(dx) < DRAG_DEAD_ZONE && Math.abs(dy) < DRAG_DEAD_ZONE) {
            return;
          }
          hasDraggedRef.current = true;
        }

        offsetXRef.current = offsetStartRef.current.x + dx;
        offsetYRef.current = offsetStartRef.current.y + dy;

        updateViewport();
        markDirty();
      } else {
        // 悬停模式
        if (destroyedRef.current) return;
        if (useCanvasStore.getState().isTransitioning) return;

        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const activeGroupIdx = useCanvasStore.getState().currentGroupIndex;
        const az = actualZoomRef.current;
        const contentX = (screenX - offsetXRef.current) / az;
        const contentY = (screenY - offsetYRef.current) / az;

        let newHoveredHash: string | null = null;

        for (const [hash, item] of canvasItemsRef.current) {
          if (item.alpha <= 0) continue;
          const layoutItem = visibleItemsRef.current.find(li => li.hash === hash);
          if (!layoutItem || layoutItem.groupIndex !== activeGroupIdx) continue;

          if (item.hitTest(contentX, contentY)) {
            newHoveredHash = hash;
            break;
          }
        }

        if (newHoveredHash !== hoveredHashRef.current) {
          // 清除旧悬停
          if (hoveredHashRef.current) {
            const oldItem = canvasItemsRef.current.get(hoveredHashRef.current);
            if (oldItem) oldItem.setHovered(false);
          }
          // 设置新悬停
          if (newHoveredHash) {
            const newItem = canvasItemsRef.current.get(newHoveredHash);
            if (newItem) newItem.setHovered(true);
          }
          hoveredHashRef.current = newHoveredHash;
          markDirty();
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const wasDragging = isDraggingRef.current;
      isDraggingRef.current = false;

      if (wasDragging && !hasDraggedRef.current) {
        handleCanvasClick(e);
      } else if (wasDragging && hasDraggedRef.current) {
        // 从 offset 反推 scrollY
        const { currentGroupIndex } = useCanvasStore.getState();
        const az = getActualZoom(currentGroupIndex);
        const vertOffset = computeVerticalOffset(currentGroupIndex, az);
        scrollYRef.current = -(offsetYRef.current - vertOffset) / az;
      }
    };

    const handleCanvasClick = (e: PointerEvent) => {
      if (useCanvasStore.getState().isTransitioning) return;

      const activeGroupIdx = useCanvasStore.getState().currentGroupIndex;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const az = actualZoomRef.current;
      const contentX = (screenX - offsetXRef.current) / az;
      const contentY = (screenY - offsetYRef.current) / az;

      for (const [hash, item] of canvasItemsRef.current) {
        if (item.alpha <= 0) continue;
        const layoutItem = visibleItemsRef.current.find(li => li.hash === hash);
        if (!layoutItem || layoutItem.groupIndex !== activeGroupIdx) continue;

        if (item.hitTest(contentX, contentY)) {
          useSelectionStore.getState().toggleSelection(hash);
          syncSelectionVisuals();
          return;
        }
      }
    };

    // ── 键盘事件 ──
    const handleKeyDown = (e: KeyboardEvent) => {
      if (destroyedRef.current) return;

      // 忽略输入框中的按键
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'w':
          useCanvasStore.getState().prevGroup();
          break;
        case 's':
          useCanvasStore.getState().nextGroup();
          break;
        case 'q':
          useSelectionStore.getState().clearSelection();
          syncSelectionVisuals();
          break;
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const { currentGroupIndex } = useCanvasStore.getState();
            const currentLayout = layoutRef.current;
            const page = currentLayout.pages[currentGroupIndex];
            if (page) {
              const hashes = page.items.map(item => item.hash);
              useSelectionStore.getState().selectAllInGroup(hashes);
              syncSelectionVisuals();
            }
          }
          break;
      }
    };

    // ── 绑定事件 ──
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);

    // ── ResizeObserver ──
    const resizeObserver = new ResizeObserver(() => {
      if (destroyedRef.current) return;
      setupCanvas();
      // 重建 DotBackground pattern（因为 ctx 变了）
      const newCtx = ctxRef.current;
      if (newCtx && bgLayerRef.current) {
        bgLayerRef.current.updateTheme(useThemeStore.getState().theme, newCtx);
      }
      updateViewport();
      markDirty();
    });
    resizeObserver.observe(container);

    // ── DPR 变化监听 ──
    let dprMediaQuery: MediaQueryList | null = null;
    const handleDprChange = () => {
      if (destroyedRef.current) return;
      setupCanvas();
      const newCtx = ctxRef.current;
      if (newCtx && bgLayerRef.current) {
        bgLayerRef.current.updateTheme(useThemeStore.getState().theme, newCtx);
      }
      updateViewport();
      markDirty();

      // 重新监听新 DPR
      dprMediaQuery?.removeEventListener('change', handleDprChange);
      dprMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprMediaQuery.addEventListener('change', handleDprChange);
    };
    dprMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    dprMediaQuery.addEventListener('change', handleDprChange);

    // ── 初始定位 ──
    positionToGroup(useCanvasStore.getState().currentGroupIndex, false);

    // ── 首帧渲染 ──
    dirtyRef.current = true;
    rafIdRef.current = requestAnimationFrame(renderFrame);

    // ── Cleanup ──
    return () => {
      destroyedRef.current = true;

      if (transitionAnimRef.current != null) {
        cancelAnimationFrame(transitionAnimRef.current);
      }
      cancelAnimationFrame(rafIdRef.current);

      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);

      resizeObserver.disconnect();
      dprMediaQuery?.removeEventListener('change', handleDprChange);

      for (const item of canvasItemsRef.current.values()) {
        item.destroy();
      }
      canvasItemsRef.current.clear();
      visibleItemsRef.current = [];

      imageLoaderRef.current?.destroy();
      imageLoaderRef.current = null;

      bgLayerRef.current?.destroy();
      bgLayerRef.current = null;
      ctxRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setZoom]);

  // ── 监听 currentGroupIndex 变化 → 带动画切换 ──
  useEffect(() => {
    if (isTransitioning) {
      positionToGroup(currentGroupIndex, true);
    }
  }, [currentGroupIndex, isTransitioning, positionToGroup]);

  // ── layout 变化时重置到第一组 ──
  useEffect(() => {
    const currentLayout = layoutRef.current;
    if (!currentLayout.pages || currentLayout.pages.length === 0) return;

    useCanvasStore.getState().setGroupCount(currentLayout.pages.length);
    useCanvasStore.setState({
      currentGroupIndex: 0,
      isTransitioning: false,
    });
    positionToGroup(0, false);
  }, [layout, positionToGroup]);

  // ── 暴露 handle ──
  useImperativeHandle(ref, () => ({
    syncSelectionVisuals: () => {
      syncSelectionVisualsRef.current?.();
    },
    scrollToY: (y: number) => {
      const { currentGroupIndex } = useCanvasStore.getState();
      const az = getActualZoom(currentGroupIndex);
      scrollYRef.current = y;
      const vertOffset = computeVerticalOffset(currentGroupIndex, az);
      offsetYRef.current = -y * az + vertOffset;
      updateViewport();
      markDirty();
    },
    updateItemMetadata: (hash: string) => {
      const canvasItem = canvasItemsRef.current.get(hash);
      if (!canvasItem) return;
      const meta = metadataMapRef.current.get(hash);
      const fileName = fileNamesRef.current.get(hash) ?? hash;
      canvasItem.setImageInfo(fileName, meta);
      markDirty();
    },
  }), [updateViewport, getActualZoom, computeVerticalOffset, markDirty]);

  // ── 外部缩放同步 ──
  useEffect(() => {
    if (screenWidthRef.current === 0) return;
    if (Math.abs(storeZoomLevel - zoomLevelRef.current) < 0.001) return;

    const newZoom = storeZoomLevel;
    const { currentGroupIndex } = useCanvasStore.getState();
    const az = newZoom * getZoomCompensation(currentGroupIndex);

    actualZoomRef.current = az;
    offsetXRef.current = computeGroupX(currentGroupIndex, az);

    const page = layoutRef.current.pages[currentGroupIndex];
    const screenHeight = screenHeightRef.current;
    const maxScrollY = page ? Math.max(0, page.contentHeight - screenHeight / az) : 0;
    scrollYRef.current = Math.min(scrollYRef.current, maxScrollY);
    const vertOffset = computeVerticalOffset(currentGroupIndex, az);
    offsetYRef.current = -scrollYRef.current * az + vertOffset;

    zoomLevelRef.current = newZoom;

    for (const item of canvasItemsRef.current.values()) {
      item.updateZoomVisibility(az);
    }

    handleZoomThresholdChange(az);
    updateViewport();
    markDirty();
  }, [storeZoomLevel, handleZoomThresholdChange, updateViewport, computeVerticalOffset, computeGroupX, getZoomCompensation, markDirty]);

  // ── fitToWindow ──
  useEffect(() => {
    if (fitCounter === 0) return;
    if (screenWidthRef.current === 0) return;

    const { currentGroupIndex } = useCanvasStore.getState();
    const currentLayout = layoutRef.current;
    const page = currentLayout.pages[currentGroupIndex];

    const FIT_PADDING_X = 40;
    const FIT_PADDING_Y = 20;
    const screenWidth = screenWidthRef.current;
    const screenHeight = screenHeightRef.current;
    const effectiveWidth = screenWidth - FIT_PADDING_X * 2;
    const effectiveHeight = screenHeight - FIT_PADDING_Y * 2;

    const compensation = getZoomCompensation(currentGroupIndex);
    let az = 1.0;
    if (page && currentLayout.pageWidth > 0 && page.contentHeight > 0) {
      const pureContentHeight = page.contentHeight
        - DEFAULT_LAYOUT_CONFIG.paddingTop
        - DEFAULT_LAYOUT_CONFIG.paddingBottom;
      const zoomX = effectiveWidth / currentLayout.pageWidth;
      const zoomY = effectiveHeight / (pureContentHeight > 0 ? pureContentHeight : page.contentHeight);
      az = Math.max(MIN_ZOOM * compensation, Math.min(Math.min(zoomX, zoomY), MAX_ZOOM * compensation));
    }

    const newZoom = az / compensation;

    actualZoomRef.current = az;
    zoomLevelRef.current = newZoom;
    scrollYRef.current = 0;
    setZoom(newZoom);

    offsetXRef.current = computeGroupX(currentGroupIndex, az);
    offsetYRef.current = computeVerticalOffset(currentGroupIndex, az);

    for (const item of canvasItemsRef.current.values()) {
      item.updateZoomVisibility(az);
    }

    handleZoomThresholdChange(az);
    updateViewport();
    markDirty();
  }, [fitCounter, layout, handleZoomThresholdChange, updateViewport, computeVerticalOffset, computeGroupX, setZoom, getZoomCompensation, markDirty]);

  // ── 选中数量播报 ──
  const selectedCount = useSelectionStore((s) => s.selectedCount);
  const themeValue = useThemeStore((s) => s.theme);

  // ── 订阅选中状态变化 ──
  useEffect(() => {
    syncSelectionVisualsRef.current?.();
  }, [selectedCount]);

  // ── 订阅主题变化 ──
  useEffect(() => {
    const ctx = ctxRef.current;
    const bgLayer = bgLayerRef.current;
    if (!ctx || !bgLayer) return;

    bgLayer.updateTheme(themeValue, ctx);
    markDirty();
  }, [themeValue, markDirty]);

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
        position: 'relative',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
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
