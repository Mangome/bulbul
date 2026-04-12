// ============================================================
// 放大镜组件 (Loupe)
//
// HTML overlay React 组件，跟随鼠标显示方形圆角放大镜视窗。
// 鼠标在缩略图上的位置精确映射到 medium 质量全图对应区域。
// 支持滚轮调节放大倍率（1.5x-10x），EXIF orientation 正确处理。
// ============================================================

import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import type { ImageMetadata } from '../../types';
import { DEFAULT_LAYOUT_CONFIG } from '../../utils/layout';
import styles from './Loupe.module.css';

// ─── 常量 ─────────────────────────────────────────────

const LOUPE_SIZE = 200;
const OFFSET_X = 20;
const OFFSET_Y = 10;
const MIN_MAGNIFICATION = 1.5;
const MAX_MAGNIFICATION = 10;
const DEFAULT_MAGNIFICATION = 3.0;
const FADE_IN_MS = 150;
const FADE_OUT_MS = 100;

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const FADE_IN_DURATION = prefersReducedMotion ? 0 : FADE_IN_MS;
const FADE_OUT_DURATION = prefersReducedMotion ? 0 : FADE_OUT_MS;

// ─── Props & Handle ──────────────────────────────────

export interface ItemRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Loupe 计算出的源区域映射回缩略图内容坐标 */
export interface LoupeSourceRect {
  /** 缩略图内容坐标 X */
  x: number;
  /** 缩略图内容坐标 Y */
  y: number;
  /** 内容坐标空间中的宽度 */
  w: number;
  /** 内容坐标空间中的高度 */
  h: number;
}

export interface LoupeProps {
  visible: boolean;
  hash: string | null;
  mouseX: number;
  mouseY: number;
  itemRect: ItemRect | null;
  zoom: number;
  scrollY: number;
  magnification: number;
  onMagnificationChange: (mag: number) => void;
  onSourceRectChange: (rect: LoupeSourceRect | null) => void;
  metadataMap: Map<string, ImageMetadata>;
  viewportWidth: number;
  viewportHeight: number;
}

export interface LoupeHandle {
  adjustMagnification: (deltaY: number) => void;
  getMagnification: () => number;
}

// ─── Component ────────────────────────────────────────

export const Loupe = forwardRef<LoupeHandle, LoupeProps>(function Loupe(
  {
    visible,
    hash,
    mouseX,
    mouseY,
    itemRect,
    zoom,
    scrollY,
    magnification: magnificationProp,
    onMagnificationChange,
    onSourceRectChange,
    metadataMap,
    viewportWidth,
    viewportHeight,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevHashRef = useRef<string | null>(null);
  const mediumBitmapRef = useRef<ImageBitmap | null>(null);
  const orientedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const magnificationRef = useRef(DEFAULT_MAGNIFICATION);

  // 同步外部 magnification
  useEffect(() => {
    magnificationRef.current = magnificationProp;
  }, [magnificationProp]);
  const [opacity, setOpacity] = useState(0);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);

  // ── 倍率调节（imperative） ──

  const adjustMagnification = useCallback((deltaY: number) => {
    const old = magnificationRef.current;
    const next = old * (1 - deltaY * 0.005);
    const clamped = Math.min(MAX_MAGNIFICATION, Math.max(MIN_MAGNIFICATION, next));
    magnificationRef.current = clamped;
    onMagnificationChange(clamped);
  }, [onMagnificationChange]);

  useImperativeHandle(ref, () => ({
    adjustMagnification,
    getMagnification: () => magnificationRef.current,
  }), [adjustMagnification]);

  // ── Medium ImageBitmap 加载 + 离屏 canvas 预旋转 ──

  useEffect(() => {
    if (!hash || hash === prevHashRef.current) return;

    // 取消上一次加载
    loadAbortRef.current?.abort();
    const abortController = new AbortController();
    loadAbortRef.current = abortController;

    // 释放旧资源
    if (mediumBitmapRef.current) {
      mediumBitmapRef.current.close();
      mediumBitmapRef.current = null;
    }
    orientedCanvasRef.current = null;
    prevHashRef.current = hash;

    import('../../services/imageService').then((imageService) => {
      if (abortController.signal.aborted) return;
      imageService.getImageUrl(hash, 'medium').then((url) => {
        if (abortController.signal.aborted) return;
        fetch(url)
          .then((r) => r.blob())
          .then((blob) => createImageBitmap(blob))
          .then((bitmap) => {
            if (abortController.signal.aborted) {
              bitmap.close();
              return;
            }
            mediumBitmapRef.current = bitmap;

            // 离屏 canvas 预旋转 EXIF orientation
            const meta = metadataMap.get(hash);
            const orientation = meta?.orientation ?? 1;
            orientedCanvasRef.current = createOrientedCanvas(bitmap, orientation);
          })
          .catch(() => {
            // 加载失败，静默处理
          });
      });
    });

    return () => {
      abortController.abort();
    };
  }, [hash, metadataMap]);

  // ── 组件卸载时释放资源 ──

  useEffect(() => {
    return () => {
      if (mediumBitmapRef.current) {
        mediumBitmapRef.current.close();
        mediumBitmapRef.current = null;
      }
      orientedCanvasRef.current = null;
      loadAbortRef.current?.abort();
    };
  }, []);

  // ── 淡入淡出 ──

  useEffect(() => {
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }

    if (visible) {
      setOpacity(1);
    } else {
      fadeTimerRef.current = setTimeout(() => {
        setOpacity(0);
      }, FADE_OUT_DURATION);
    }

    return () => {
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
      }
    };
  }, [visible]);

  // ── 绘制逻辑 ──

  useEffect(() => {
    if (opacity <= 0) {
      onSourceRectChange(null);
      return;
    }
    if (!itemRect || !orientedCanvasRef.current) {
      onSourceRectChange(null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = LOUPE_SIZE * dpr;
    canvas.height = LOUPE_SIZE * dpr;
    canvas.style.width = LOUPE_SIZE + 'px';
    canvas.style.height = LOUPE_SIZE + 'px';
    ctx.scale(dpr, dpr);

    const oriented = orientedCanvasRef.current;
    const M = magnificationRef.current;
    const meta = hash ? metadataMap.get(hash) : null;

    // 坐标映射：屏幕 → 内容 → 缩略图相对 → medium 逻辑坐标
    const offsetY = -scrollY * zoom + DEFAULT_LAYOUT_CONFIG.paddingTop;
    const contentX = mouseX / zoom;
    const contentY = (mouseY - offsetY) / zoom;
    const relX = (contentX - itemRect.x) / itemRect.width;
    const relY = (contentY - itemRect.y) / itemRect.height;

    // 逻辑尺寸（后端已为 orientation 5-8 交换宽高）
    const logicalW = meta?.imageWidth ?? oriented.width;
    const logicalH = meta?.imageHeight ?? oriented.height;

    const logicalX = relX * logicalW;
    const logicalY = relY * logicalH;

    // 放大源区域大小
    const sourceW = LOUPE_SIZE * logicalW / (M * itemRect.width * zoom);
    const sourceH = LOUPE_SIZE * logicalH / (M * itemRect.height * zoom);

    let sx = logicalX - sourceW / 2;
    let sy = logicalY - sourceH / 2;

    // 边界 clamp
    if (sx < 0) sx = 0;
    if (sy < 0) sy = 0;
    if (sx + sourceW > logicalW) sx = logicalW - sourceW;
    if (sy + sourceH > logicalH) sy = logicalH - sourceH;
    if (sx < 0) sx = 0;
    if (sy < 0) sy = 0;

    ctx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    ctx.drawImage(oriented, sx, sy, sourceW, sourceH, 0, 0, LOUPE_SIZE, LOUPE_SIZE);

    // 将源区域映射回缩略图内容坐标，通知 InfiniteCanvas 绘制方框
    if (itemRect) {
      const thumbX = itemRect.x + (sx / logicalW) * itemRect.width;
      const thumbY = itemRect.y + (sy / logicalH) * itemRect.height;
      const thumbW = (sourceW / logicalW) * itemRect.width;
      const thumbH = (sourceH / logicalH) * itemRect.height;
      onSourceRectChange({ x: thumbX, y: thumbY, w: thumbW, h: thumbH });
    }
  }, [opacity, mouseX, mouseY, itemRect, zoom, scrollY, hash, metadataMap, onSourceRectChange]);

  // ── 定位计算 ──

  const position = calculatePosition(mouseX, mouseY, viewportWidth, viewportHeight);

  if (opacity <= 0 && !visible) return null;

  const mag = magnificationRef.current;
  const magLabel = mag >= 10 ? '10x' : mag.toFixed(1) + 'x';

  return (
    <div
      className={styles.container}
      style={{
        left: position.x,
        top: position.y,
        opacity,
        transition: opacity > 0 ? `opacity ${FADE_IN_DURATION}ms ease` : undefined,
      }}
    >
      <div className={styles.canvasWrap}>
        <canvas ref={canvasRef} />
      </div>
      <span className={styles.magnificationLabel}>{magLabel}</span>
    </div>
  );
});

// ─── 离屏 canvas 预旋转 EXIF orientation ─────────────

function createOrientedCanvas(
  bitmap: ImageBitmap,
  orientation: number,
): HTMLCanvasElement {
  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const isRotated = orientation >= 5 && orientation <= 8;

  const outW = isRotated ? srcH : srcW;
  const outH = isRotated ? srcW : srcH;

  const offscreen = document.createElement('canvas');
  offscreen.width = outW;
  offscreen.height = outH;
  const ctx = offscreen.getContext('2d')!;

  ctx.save();

  switch (orientation) {
    case 1:
    default:
      ctx.drawImage(bitmap, 0, 0);
      break;
    case 2:
      ctx.translate(outW, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(bitmap, 0, 0);
      break;
    case 3:
      ctx.translate(outW, outH);
      ctx.rotate(Math.PI);
      ctx.drawImage(bitmap, 0, 0);
      break;
    case 4:
      ctx.translate(0, outH);
      ctx.scale(1, -1);
      ctx.drawImage(bitmap, 0, 0);
      break;
    case 5:
      ctx.translate(outW, 0);
      ctx.rotate(Math.PI / 2);
      ctx.scale(-1, 1);
      ctx.drawImage(bitmap, 0, 0);
      break;
    case 6:
      ctx.translate(outW, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(bitmap, 0, 0);
      break;
    case 7:
      ctx.translate(0, outH);
      ctx.rotate(Math.PI / 2);
      ctx.scale(-1, 1);
      ctx.drawImage(bitmap, 0, 0);
      break;
    case 8:
      ctx.translate(0, outH);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(bitmap, 0, 0);
      break;
  }

  ctx.restore();
  return offscreen;
}

// ─── 定位计算 ────────────────────────────────────────

function calculatePosition(
  mouseX: number,
  mouseY: number,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  let x: number;
  let y: number;

  // 默认右上方偏移
  if (mouseX + OFFSET_X + LOUPE_SIZE < viewportWidth) {
    x = mouseX + OFFSET_X;
  } else {
    x = mouseX - LOUPE_SIZE - OFFSET_X;
  }

  // 默认上方
  y = mouseY - OFFSET_Y - LOUPE_SIZE;

  // 上方空间不足 → 下方
  if (y < 0) {
    y = mouseY + OFFSET_Y;
  }

  // 下边界
  if (y + LOUPE_SIZE > viewportHeight) {
    y = viewportHeight - LOUPE_SIZE;
  }
  if (y < 0) y = 0;

  // 左边界
  if (x < 0) x = 0;
  if (x + LOUPE_SIZE > viewportWidth) {
    x = viewportWidth - LOUPE_SIZE;
  }

  return { x, y };
}
