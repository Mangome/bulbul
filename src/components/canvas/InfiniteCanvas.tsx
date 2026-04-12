// ============================================================
// 无限画布 (InfiniteCanvas) — Canvas 2D 纵向滚动引擎
//
// React 组件，管理原生 HTMLCanvasElement 生命周期。
// 使用 dirty flag + requestAnimationFrame 按需渲染。
//
// 绘制顺序:
// 1. 清空 Canvas + 背景色
// 2. DotBackground（固定视口坐标）
// 3. ctx.save/translate/scale → 内容坐标系
//    3a. drawGroupTitles()
//    3b. CanvasImageItem.draw() × N
// 4. ctx.restore
//
// 交互模式:
// - 普通滚轮 → 纵向滚动
// - Ctrl+滚轮 → 缩放（Y 轴锚点）
// - 左键拖拽 → 纵向平移
// - 点击 → 选中/取消图片
// - W/S → 纵向滚动到上/下一组
// ============================================================

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef, useState } from 'react';
import { DotBackground } from './DotBackground';
import { CanvasImageItem } from './CanvasImageItem';
import { ImageLoader, getSizeForDisplay } from '../../hooks/useImageLoader';
import { drawGroupTitles } from './GroupTitle';
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
import { Magnifier } from './Magnifier';

// ─── 常量 ─────────────────────────────────────────────

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5.0;
const ZOOM_SENSITIVITY = 0.001;
const TRACKPAD_ZOOM_SENSITIVITY = 0.01;
const DRAG_DEAD_ZONE = 5;
const BG_COLOR_LIGHT = '#FFFFFF';
const BG_COLOR_DARK = '#0A0E1A';
const SCROLL_ANIMATION_MS =
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
  /** 将画布视口滚动到指定分组 */
  scrollToGroup: (groupIndex: number) => void;
  /** 更新指定 hash 的 item 元数据（合焦评分逐张到达时调用） */
  updateItemMetadata: (hash: string) => void;
}

// ─── 缓动函数 ────────────────────────────────────────

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
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

  // Canvas 尺寸（CSS 像素）
  const screenWidthRef = useRef(0);
  const screenHeightRef = useRef(0);
  const dprRef = useRef(1);

  // Dirty flag + rAF
  const dirtyRef = useRef(true);
  const rafIdRef = useRef(0);
  const destroyedRef = useRef(false);

  /** 上次质量判断对应的 size（基于 displayWidth） */
  const prevSizeRef = useRef<string>('thumbnail');

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

  // ── 纵向滚动状态 ──
  const scrollYRef = useRef(0);
  const zoomLevelRef = useRef(1.0);

  // ── Drag state ──
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const scrollYStartRef = useRef(0);
  const hasDraggedRef = useRef(false);

  // ── 滚动动画状态 ──
  const scrollAnimRef = useRef<{
    startTime: number;
    startScrollY: number;
    targetScrollY: number;
  } | null>(null);

  // ── 悬停状态 ──
  const hoveredHashRef = useRef<string | null>(null);

  // ── Magnifier 状态 ──
  const [magnifierState, setMagnifierState] = useState<{
    visible: boolean;
    hash: string | null;
    mouseX: number;
    mouseY: number;
  }>({ visible: false, hash: null, mouseX: 0, mouseY: 0 });

  // ── wheel 事件 throttle ──
  const lastWheelUpdateTimeRef = useRef<number>(0);
  const WHEEL_THROTTLE_MS = 16;

  // Store sync
  const storeZoomLevel = useCanvasStore((s) => s.zoomLevel);
  const fitCounter = useCanvasStore((s) => s.fitCounter);
  const showDetectionOverlay = useCanvasStore((s) => s.showDetectionOverlay);
  const currentGroupIndex = useCanvasStore((s) => s.currentGroupIndex);
  const setZoom = useCanvasStore((s) => s.setZoom);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const setViewportRect = useCanvasStore((s) => s.setViewportRect);

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

  // ─── 坐标计算辅助 ────────────────────────────────────

  const getMaxScrollY = useCallback((): number => {
    const currentLayout = layoutRef.current;
    const screenHeight = screenHeightRef.current;
    const zoom = zoomLevelRef.current;
    return Math.max(0, currentLayout.totalHeight - screenHeight / zoom);
  }, []);

  const clampScrollY = useCallback((y: number): number => {
    return Math.max(0, Math.min(y, getMaxScrollY()));
  }, [getMaxScrollY]);

  // ─── 视口更新 ────────────────────────────────────────

  const updateViewport = useCallback(() => {
    const zoom = zoomLevelRef.current;
    if (zoom === 0) return;

    const scrollY = scrollYRef.current;
    const screenWidth = screenWidthRef.current;
    const screenHeight = screenHeightRef.current;

    const viewport: ViewportRect = {
      x: 0,
      y: scrollY,
      width: screenWidth / zoom,
      height: screenHeight / zoom,
    };

    setViewport(0, scrollY);
    setViewportRect(viewport);

    const currentLayout = layoutRef.current;
    if (!currentLayout.pages || currentLayout.pages.length === 0) return;

    const newVisible = getVisibleItems(
      currentLayout.pages,
      0, // pageWidth 在纵向模式下不使用
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
        imageLoaderRef.current?.unpinImage(item.hash);
      }
    }

    // 处理进入视口的元素
    const imageLoader = imageLoaderRef.current;

    for (const item of diff.enter) {
      if (canvasItemsRef.current.has(item.hash)) continue;

      const canvasItem = new CanvasImageItem(item);
      const fileName = fileNamesRef.current.get(item.hash) ?? item.hash;
      const meta = metadataMapRef.current.get(item.hash);
      canvasItem.setImageInfo(fileName, meta);

      // 同步选中 + 检测框状态
      const { selectedHashes } = useSelectionStore.getState();
      const { showDetectionOverlay: showOverlay } = useCanvasStore.getState();
      if (showOverlay) {
        const bboxes = meta?.detectionBboxes ?? [];
        canvasItem.setDetectionBoxes(bboxes);
        canvasItem.setDetectionVisible(bboxes.length > 0);
      }

      canvasItem.setSelected(selectedHashes.has(item.hash));
      canvasItem.alpha = 1;

      canvasItemsRef.current.set(item.hash, canvasItem);
      imageLoader?.pinImage(item.hash);

      if (imageLoader) {
        imageLoader
          .loadImage(item.hash, item.width * zoom)
          .then((result) => {
            if (!result || destroyedRef.current || !imageLoaderRef.current) return;
            if (!imageLoaderRef.current.getCache().isImageValid(result.key, result.version)) return;
            const ci = canvasItemsRef.current.get(item.hash);
            if (ci) {
              const itemMeta = metadataMapRef.current.get(item.hash);
              ci.setImage(result.image, itemMeta?.orientation ?? 1);
              const { showDetectionOverlay: showOverlay } = useCanvasStore.getState();
              if (showOverlay) {
                const bboxes = itemMeta?.detectionBboxes ?? [];
                ci.setDetectionBoxes(bboxes);
                ci.setDetectionVisible(bboxes.length > 0);
              }
              markDirty();
            }
          });
      }
    }

    visibleItemsRef.current = newVisible;

    // 更新当前分组索引
    const currentGroupIdx = getCurrentGroupIndex(scrollY, currentLayout.pages);
    const storeState = useCanvasStore.getState();
    if (storeState.currentGroupIndex !== currentGroupIdx) {
      internalGroupUpdateRef.current = true;
      useCanvasStore.setState({ currentGroupIndex: currentGroupIdx });
    }
  }, [setViewport, setViewportRect, markDirty]);

  // ─── 缩放阈值切换 ──────────────────────────────────────

  const handleZoomThresholdChange = useCallback(
    (newZoom: number) => {
      const visibleItems = visibleItemsRef.current;
      if (visibleItems.length === 0) return;

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

    // ── 处理滚动动画 ──
    const scrollAnim = scrollAnimRef.current;
    if (scrollAnim) {
      const elapsed = now - scrollAnim.startTime;
      const duration = SCROLL_ANIMATION_MS;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutQuart(progress);

      scrollYRef.current = scrollAnim.startScrollY + (scrollAnim.targetScrollY - scrollAnim.startScrollY) * eased;

      if (progress >= 1) {
        scrollAnimRef.current = null;
        scrollYRef.current = scrollAnim.targetScrollY;
      }

      updateViewport();
    }

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
    const zoom = zoomLevelRef.current;
    const scrollY = scrollYRef.current;
    const offsetY = -scrollY * zoom + DEFAULT_LAYOUT_CONFIG.paddingTop;

    ctx.save();
    ctx.translate(0, offsetY);
    ctx.scale(zoom, zoom);

    // 3a. 绘制分组标题
    const currentLayout = layoutRef.current;
    drawGroupTitles(ctx, currentLayout.groupTitles);

    // 3b. 绘制所有可见 CanvasImageItem
    let needsNextFrame = false;
    const itemsToReload: CanvasImageItem[] = [];
    for (const item of canvasItemsRef.current.values()) {
      const itemNeedsFrame = item.draw(ctx, zoom, now);
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
            .loadImage(item.hash, item.getWidth() * zoom)
            .then((result) => {
              if (!result || destroyedRef.current || !imageLoaderRef.current) return;
              if (!imageLoaderRef.current.getCache().isImageValid(result.key, result.version)) return;
              const ci = canvasItemsRef.current.get(item.hash);
              if (ci) {
                const itemMeta = metadataMapRef.current.get(item.hash);
                ci.setImage(result.image, itemMeta?.orientation ?? 1);
                const { showDetectionOverlay: showOverlay } = useCanvasStore.getState();
                if (showOverlay) {
                  const bboxes = itemMeta?.detectionBboxes ?? [];
                  ci.setDetectionBoxes(bboxes);
                  ci.setDetectionVisible(bboxes.length > 0);
                }
                markDirty();
              }
            });
        }
      }
    }

    // 如果有动画进行中，继续请求下一帧
    if (scrollAnimRef.current || needsNextFrame) {
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

      // 中断正在进行的滚动动画
      if (scrollAnimRef.current) {
        scrollAnimRef.current = null;
      }

      if (e.ctrlKey || e.metaKey) {
        // Ctrl+滚轮：缩放（Y 轴锚点）
        const oldZoom = zoomLevelRef.current;
        const isTrackpadPinch = Math.abs(e.deltaY) < 50;
        const sensitivity = isTrackpadPinch ? TRACKPAD_ZOOM_SENSITIVITY : ZOOM_SENSITIVITY;
        const delta = -e.deltaY * sensitivity;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * (1 + delta)));
        if (newZoom === oldZoom) return;

        // 鼠标锚点缩放（Y 轴）
        const rect = canvas.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;
        const contentMouseY = (mouseY - DEFAULT_LAYOUT_CONFIG.paddingTop) / oldZoom + scrollYRef.current;

        zoomLevelRef.current = newZoom;

        // 调整 scrollY 以保持鼠标下方内容不变
        scrollYRef.current = clampScrollY(
          contentMouseY - (mouseY - DEFAULT_LAYOUT_CONFIG.paddingTop) / newZoom,
        );

        setZoom(newZoom);

        handleZoomThresholdChange(newZoom);
        const now = performance.now();
        if (now - lastWheelUpdateTimeRef.current >= WHEEL_THROTTLE_MS) {
          updateViewport();
          lastWheelUpdateTimeRef.current = now;
        }
        markDirty();
      } else {
        // 普通滚轮：纵向滚动
        const zoom = zoomLevelRef.current;
        scrollYRef.current = clampScrollY(scrollYRef.current + e.deltaY / zoom);

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
      scrollYStartRef.current = scrollYRef.current;

      // 拖拽期间隐藏放大镜
      setMagnifierState(prev => prev.visible ? { ...prev, visible: false } : prev);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (isDraggingRef.current) {
        // 拖拽模式：仅纵向
        if (destroyedRef.current) return;

        const dy = e.clientY - dragStartRef.current.y;

        if (!hasDraggedRef.current) {
          if (Math.abs(dy) < DRAG_DEAD_ZONE) {
            return;
          }
          hasDraggedRef.current = true;
        }

        scrollYRef.current = clampScrollY(scrollYStartRef.current - dy / zoomLevelRef.current);

        updateViewport();
        markDirty();
      } else {
        // 悬停模式 → hitTest + 通知 Magnifier
        if (destroyedRef.current) return;

        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const zoom = zoomLevelRef.current;
        const offsetY = -scrollYRef.current * zoom + DEFAULT_LAYOUT_CONFIG.paddingTop;
        const contentX = screenX / zoom;
        const contentY = (screenY - offsetY) / zoom;

        let newHoveredHash: string | null = null;

        for (const [hash, item] of canvasItemsRef.current) {
          if (item.alpha <= 0) continue;
          if (item.hitTest(contentX, contentY)) {
            newHoveredHash = hash;
            break;
          }
        }

        if (newHoveredHash !== hoveredHashRef.current) {
          hoveredHashRef.current = newHoveredHash;

          if (newHoveredHash) {
            setMagnifierState({
              visible: true,
              hash: newHoveredHash,
              mouseX: e.clientX - rect.left,
              mouseY: e.clientY - rect.top,
            });
          } else {
            setMagnifierState(prev => prev.visible ? { ...prev, visible: false } : prev);
          }
        } else if (newHoveredHash) {
          // 更新鼠标位置
          setMagnifierState(prev => ({
            ...prev,
            mouseX: e.clientX - rect.left,
            mouseY: e.clientY - rect.top,
          }));
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const wasDragging = isDraggingRef.current;
      isDraggingRef.current = false;

      if (wasDragging && !hasDraggedRef.current) {
        handleCanvasClick(e);
      }
    };

    const handleCanvasClick = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const zoom = zoomLevelRef.current;
      const offsetY = -scrollYRef.current * zoom + DEFAULT_LAYOUT_CONFIG.paddingTop;
      const contentX = screenX / zoom;
      const contentY = (screenY - offsetY) / zoom;

      for (const [hash, item] of canvasItemsRef.current) {
        if (item.alpha <= 0) continue;
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
          scrollToAdjacentGroup(-1);
          break;
        case 's':
          scrollToAdjacentGroup(1);
          break;
        case 'q':
          useSelectionStore.getState().clearSelection();
          syncSelectionVisuals();
          break;
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            // 全选当前分组
            const currentLayout = layoutRef.current;
            const idx = useCanvasStore.getState().currentGroupIndex;
            const page = currentLayout.pages[idx];
            if (page) {
              const hashes = page.items.map(item => item.hash);
              useSelectionStore.getState().selectAllInGroup(hashes);
              syncSelectionVisuals();
            }
          }
          break;
      }
    };

    /** 滚动到上/下一组 */
    function scrollToAdjacentGroup(direction: 1 | -1) {
      const currentLayout = layoutRef.current;
      const pages = currentLayout.pages;
      if (pages.length === 0) return;

      // 中断当前动画
      scrollAnimRef.current = null;

      const currentIdx = useCanvasStore.getState().currentGroupIndex;
      let targetIdx = currentIdx + direction;

      // 循环
      if (targetIdx < 0) targetIdx = pages.length - 1;
      if (targetIdx >= pages.length) targetIdx = 0;

      scrollToGroupIndex(targetIdx);
    }

    /** 滚动到指定分组（带动画） */
    function scrollToGroupIndex(groupIndex: number) {
      const currentLayout = layoutRef.current;
      const page = currentLayout.pages[groupIndex];
      if (!page) return;

      if (SCROLL_ANIMATION_MS === 0) {
        scrollYRef.current = page.offsetY;
        updateViewport();
        markDirty();
        return;
      }

      scrollAnimRef.current = {
        startTime: performance.now(),
        startScrollY: scrollYRef.current,
        targetScrollY: page.offsetY,
      };
      markDirty();
    }

    // ── 绑定事件 ──
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);

    // ── Resize / DPR 统一处理 ──
    let reinitRafId = 0;
    const scheduleReinit = () => {
      if (destroyedRef.current) return;
      if (reinitRafId) return;
      reinitRafId = requestAnimationFrame(() => {
        reinitRafId = 0;
        if (destroyedRef.current) return;
        setupCanvas();
        const newCtx = ctxRef.current;
        if (newCtx && bgLayerRef.current) {
          bgLayerRef.current.updateTheme(useThemeStore.getState().theme, newCtx);
        }
        updateViewport();
        markDirty();
      });
    };

    // ── ResizeObserver ──
    const resizeObserver = new ResizeObserver(() => {
      scheduleReinit();
    });
    resizeObserver.observe(container);

    // ── DPR 变化监听 ──
    let dprMediaQuery: MediaQueryList | null = null;
    const handleDprChange = () => {
      scheduleReinit();
      dprMediaQuery?.removeEventListener('change', handleDprChange);
      dprMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprMediaQuery.addEventListener('change', handleDprChange);
    };
    dprMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    dprMediaQuery.addEventListener('change', handleDprChange);

    // ── 首帧渲染 ──
    scrollYRef.current = 0;
    updateViewport();
    dirtyRef.current = true;
    rafIdRef.current = requestAnimationFrame(renderFrame);

    // ── Cleanup ──
    return () => {
      destroyedRef.current = true;

      scrollAnimRef.current = null;
      cancelAnimationFrame(rafIdRef.current);
      cancelAnimationFrame(reinitRafId);

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

  // ── layout 变化时重置到顶部 ──
  useEffect(() => {
    const currentLayout = layoutRef.current;
    if (!currentLayout.pages || currentLayout.pages.length === 0) return;

    useCanvasStore.getState().setGroupCount(currentLayout.pages.length);
    scrollYRef.current = 0;
    scrollAnimRef.current = null;
    internalGroupUpdateRef.current = true;
    useCanvasStore.setState({ currentGroupIndex: 0 });
    updateViewport();
    markDirty();
  }, [layout, updateViewport, markDirty]);

  // ── 外部分组导航（useKeyboard A/D 键触发）→ 纵向滚动到目标分组 ──
  const internalGroupUpdateRef = useRef(false);
  useEffect(() => {
    if (internalGroupUpdateRef.current) {
      internalGroupUpdateRef.current = false;
      return;
    }
    const currentLayout = layoutRef.current;
    const page = currentLayout.pages[currentGroupIndex];
    if (!page) return;

    // 带动画滚动到目标分组
    if (SCROLL_ANIMATION_MS === 0) {
      scrollYRef.current = page.offsetY;
      updateViewport();
      markDirty();
    } else {
      scrollAnimRef.current = {
        startTime: performance.now(),
        startScrollY: scrollYRef.current,
        targetScrollY: page.offsetY,
      };
      markDirty();
    }
  }, [currentGroupIndex, updateViewport, markDirty]);

  // ── 暴露 handle ──
  useImperativeHandle(ref, () => ({
    syncSelectionVisuals: () => {
      syncSelectionVisualsRef.current?.();
    },
    scrollToY: (y: number) => {
      scrollYRef.current = clampScrollY(y);
      updateViewport();
      markDirty();
    },
    scrollToGroup: (groupIndex: number) => {
      const currentLayout = layoutRef.current;
      const page = currentLayout.pages[groupIndex];
      if (!page) return;
      scrollYRef.current = page.offsetY;
      scrollAnimRef.current = null;
      updateViewport();
      markDirty();
    },
    updateItemMetadata: (hash: string) => {
      const canvasItem = canvasItemsRef.current.get(hash);
      if (!canvasItem) return;
      const meta = metadataMapRef.current.get(hash);
      const fileName = fileNamesRef.current.get(hash) ?? hash;
      canvasItem.setImageInfo(fileName, meta);
      const bboxes = meta?.detectionBboxes ?? [];
      canvasItem.setDetectionBoxes(bboxes);
      const { showDetectionOverlay } = useCanvasStore.getState();
      canvasItem.setDetectionVisible(showDetectionOverlay && bboxes.length > 0);
      markDirty();
    },
  }), [updateViewport, clampScrollY, markDirty]);

  // ── 检测框可见性切换：批量回填/清除 ──
  useEffect(() => {
    const items = canvasItemsRef.current;
    const metaMap = metadataMapRef.current;
    for (const item of items.values()) {
      if (showDetectionOverlay) {
        const bboxes = metaMap.get(item.hash)?.detectionBboxes ?? [];
        item.setDetectionBoxes(bboxes);
        item.setDetectionVisible(bboxes.length > 0);
      } else {
        item.setDetectionVisible(false);
      }
    }
    markDirty();
  }, [showDetectionOverlay, markDirty]);

  // ── 外部缩放同步 ──
  useEffect(() => {
    if (screenWidthRef.current === 0) return;
    if (Math.abs(storeZoomLevel - zoomLevelRef.current) < 0.001) return;

    zoomLevelRef.current = storeZoomLevel;
    handleZoomThresholdChange(storeZoomLevel);
    updateViewport();
    markDirty();
  }, [storeZoomLevel, handleZoomThresholdChange, updateViewport, markDirty]);

  // ── fitToWindow ──
  useEffect(() => {
    if (fitCounter === 0) return;
    if (screenWidthRef.current === 0) return;

    const currentLayout = layoutRef.current;
    if (currentLayout.totalHeight <= 0) return;

    const FIT_PADDING_Y = 20;
    const screenHeight = screenHeightRef.current;
    const effectiveHeight = screenHeight - FIT_PADDING_Y * 2;

    // 缩放使全部内容适应窗口高度
    const newZoom = Math.max(
      MIN_ZOOM,
      Math.min(effectiveHeight / currentLayout.totalHeight, MAX_ZOOM),
    );

    zoomLevelRef.current = newZoom;
    scrollYRef.current = 0;
    setZoom(newZoom);

    handleZoomThresholdChange(newZoom);
    updateViewport();
    markDirty();
  }, [fitCounter, layout, handleZoomThresholdChange, updateViewport, setZoom, markDirty]);

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
      <Magnifier
        visible={magnifierState.visible}
        hash={magnifierState.hash}
        mouseX={magnifierState.mouseX}
        mouseY={magnifierState.mouseY}
        metadataMap={metadataMap}
        fileNames={fileNames}
        viewportWidth={screenWidthRef.current}
        viewportHeight={screenHeightRef.current}
        isDragging={isDraggingRef.current}
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

// ─── 辅助函数 ─────────────────────────────────────────

/**
 * 根据 scrollY 在 layout pages 的 offsetY 中做二分查找，
 * 确定当前视口所在的分组索引。
 */
function getCurrentGroupIndex(
  scrollY: number,
  pages: { offsetY: number; contentHeight: number }[],
): number {
  if (pages.length === 0) return 0;

  let lo = 0;
  let hi = pages.length - 1;

  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (pages[mid].offsetY <= scrollY) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return lo;
}

export default InfiniteCanvas;
