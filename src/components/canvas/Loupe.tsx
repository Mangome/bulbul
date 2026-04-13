// ============================================================
// 放大镜组件 (Loupe)
//
// HTML overlay React 组件，跟随鼠标显示与原图同比例的放大镜视窗。
// 直接显示 medium 图 1:1 像素细节，鼠标位置映射到 medium 对应区域。
// 完整 EXIF orientation 处理。
// ============================================================

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import type { ImageMetadata } from '../../types';
import { DEFAULT_LAYOUT_CONFIG } from '../../utils/layout';
import styles from './Loupe.module.css';

// ─── 常量 ─────────────────────────────────────────────

/** 放大镜长边占视口短边的比例 */
const LOUPE_RATIO = 0.60;
/** 放大镜长边最小像素 */
const LOUPE_MIN = 300;
/** 放大镜长边最大像素 */
const LOUPE_MAX = 900;

const OFFSET_X = 20;
const OFFSET_Y = 20;
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
  scrollY: number;
  onSourceRectChange: (rect: LoupeSourceRect | null) => void;
  metadataMap: Map<string, ImageMetadata>;
  viewportWidth: number;
  viewportHeight: number;
}

export interface LoupeHandle {
  // 保留接口以免破坏调用方，但不再需要倍率调节
}

// ─── 放大镜尺寸计算 ───────────────────────────────────

/** 根据图片宽高比和视口大小，计算放大镜的 CSS 尺寸 */
function computeLoupeSize(
  imgW: number,
  imgH: number,
  vpW: number,
  vpH: number,
): { w: number; h: number } {
  const aspect = imgW / imgH; // > 1 横图，< 1 竖图
  const vpShort = Math.min(vpW, vpH);
  let longSide = Math.round(vpShort * LOUPE_RATIO);
  longSide = Math.max(LOUPE_MIN, Math.min(LOUPE_MAX, longSide));

  let w: number;
  let h: number;
  if (aspect >= 1) {
    // 横图或正方形：宽为长边
    w = longSide;
    h = Math.round(longSide / aspect);
  } else {
    // 竖图：高为长边
    h = longSide;
    w = Math.round(longSide * aspect);
  }
  return { w, h };
}

// ─── Component ────────────────────────────────────────

export const Loupe = forwardRef<LoupeHandle, LoupeProps>(function Loupe(
  {
    visible,
    hash,
    mouseX,
    mouseY,
    itemRect,
    scrollY,
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

  const [opacity, setOpacity] = useState(0);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);

  useImperativeHandle(ref, () => ({}), []);

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

  // ── 计算放大镜尺寸 ──

  const oriented = orientedCanvasRef.current;
  const loupeSize = oriented
    ? computeLoupeSize(oriented.width, oriented.height, viewportWidth, viewportHeight)
    : { w: 300, h: 200 };

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
    canvas.width = loupeSize.w * dpr;
    canvas.height = loupeSize.h * dpr;
    canvas.style.width = loupeSize.w + 'px';
    canvas.style.height = loupeSize.h + 'px';
    ctx.scale(dpr, dpr);

    const src = orientedCanvasRef.current;

    // 坐标映射：屏幕 → 内容 → 缩略图相对 → medium 像素坐标
    const offsetY = -scrollY + DEFAULT_LAYOUT_CONFIG.paddingTop;
    const contentX = mouseX;
    const contentY = mouseY - offsetY;
    const relX = (contentX - itemRect.x) / itemRect.width;
    const relY = (contentY - itemRect.y) / itemRect.height;

    const srcW = src.width;
    const srcH = src.height;

    const centerX = relX * srcW;
    const centerY = relY * srcH;

    // 1:1 像素映射：放大镜 CSS 尺寸 = medium 源区域像素数
    const sourceW = loupeSize.w;
    const sourceH = loupeSize.h;

    let sx = centerX - sourceW / 2;
    let sy = centerY - sourceH / 2;

    // 边界 clamp
    if (sx < 0) sx = 0;
    if (sy < 0) sy = 0;
    if (sx + sourceW > srcW) sx = srcW - sourceW;
    if (sy + sourceH > srcH) sy = srcH - sourceH;
    if (sx < 0) sx = 0;
    if (sy < 0) sy = 0;

    ctx.clearRect(0, 0, loupeSize.w, loupeSize.h);
    ctx.drawImage(src, sx, sy, sourceW, sourceH, 0, 0, loupeSize.w, loupeSize.h);

    // 将源区域映射回缩略图内容坐标，通知 InfiniteCanvas 绘制方框
    const thumbX = itemRect.x + (sx / srcW) * itemRect.width;
    const thumbY = itemRect.y + (sy / srcH) * itemRect.height;
    const thumbW = (sourceW / srcW) * itemRect.width;
    const thumbH = (sourceH / srcH) * itemRect.height;
    onSourceRectChange({ x: thumbX, y: thumbY, w: thumbW, h: thumbH });
  }, [opacity, mouseX, mouseY, itemRect, scrollY, hash, metadataMap, onSourceRectChange, loupeSize.w, loupeSize.h]);

  // ── 定位计算 ──

  const position = calculatePosition(mouseX, mouseY, loupeSize.w, loupeSize.h, viewportWidth, viewportHeight);

  if (opacity <= 0 && !visible) return null;

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
      <div
        className={styles.canvasWrap}
        style={{ width: loupeSize.w, height: loupeSize.h }}
      >
        <canvas ref={canvasRef} />
      </div>
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
  loupeW: number,
  loupeH: number,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  let x: number;
  let y: number;

  // 水平：优先右侧，不够则左侧
  if (mouseX + OFFSET_X + loupeW < viewportWidth) {
    x = mouseX + OFFSET_X;
  } else {
    x = mouseX - loupeW - OFFSET_X;
  }

  // 垂直：优先上方
  y = mouseY - OFFSET_Y - loupeH;

  // 上方空间不足 → 下方
  if (y < 0) {
    y = mouseY + OFFSET_Y;
  }

  // 下边界
  if (y + loupeH > viewportHeight) {
    y = viewportHeight - loupeH;
  }
  if (y < 0) y = 0;

  // 左边界
  if (x < 0) x = 0;
  if (x + loupeW > viewportWidth) {
    x = viewportWidth - loupeW;
  }

  return { x, y };
}
