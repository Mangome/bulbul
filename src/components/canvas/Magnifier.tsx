// ============================================================
// 悬浮放大镜组件 (Magnifier)
//
// HTML overlay React 组件，以 absolute 定位在画布容器内。
// 鼠标悬停缩略图时弹出大图预览窗口，显示图片信息和合焦评分。
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ImageMetadata } from '../../types';

// ─── 常量 ─────────────────────────────────────────────

const MAGNIFIER_WIDTH = 360;
const MAGNIFIER_OFFSET_X = 20;
const MAGNIFIER_OFFSET_Y = 10;
const FADE_DURATION_MS = 150;
const FOCUS_SCORE_COLORS: Record<number, string> = {
  5: '#4CAF50',
  4: '#2196F3',
  3: '#FF9800',
  2: '#F44336',
  1: '#F44336',
};

// ─── Props ────────────────────────────────────────────

export interface MagnifierProps {
  visible: boolean;
  hash: string | null;
  mouseX: number;
  mouseY: number;
  metadataMap: Map<string, ImageMetadata>;
  fileNames: Map<string, string>;
  viewportWidth: number;
  viewportHeight: number;
  isDragging: boolean;
}

// ─── 组件 ─────────────────────────────────────────────

export function Magnifier({
  visible,
  hash,
  mouseX,
  mouseY,
  metadataMap,
  fileNames,
  viewportWidth,
  viewportHeight,
  isDragging,
}: MagnifierProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [opacity, setOpacity] = useState(0);
  const prevHashRef = useRef<string | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // 加载图片 URL
  useEffect(() => {
    if (!hash) {
      setImageUrl(null);
      setThumbnailUrl(null);
      setImageLoaded(false);
      return;
    }

    // 切换图片时重置加载状态
    if (hash !== prevHashRef.current) {
      setImageLoaded(false);
      prevHashRef.current = hash;
    }

    // 使用动态 import 避免循环依赖
    import('../../services/imageService').then((imageService) => {
      imageService.getImageUrl(hash, 'medium').then((url) => {
        setImageUrl(url);
      });
      imageService.getImageUrl(hash, 'thumbnail').then((url) => {
        setThumbnailUrl(url);
      });
    });
  }, [hash]);

  // Fade in/out 动画
  useEffect(() => {
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
    }

    if (visible && !isDragging) {
      setOpacity(1);
    } else {
      fadeTimerRef.current = setTimeout(() => {
        setOpacity(0);
      }, FADE_DURATION_MS);
    }

    return () => {
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
      }
    };
  }, [visible, isDragging]);

  // 拖拽时立即隐藏
  useEffect(() => {
    if (isDragging) {
      setOpacity(0);
    }
  }, [isDragging]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const meta = hash ? metadataMap.get(hash) : null;
  const fileName = hash ? (fileNames.get(hash) ?? hash) : '';

  // 计算放大镜位置
  const position = calculatePosition(
    mouseX, mouseY,
    viewportWidth, viewportHeight,
    meta?.imageWidth ?? null,
    meta?.imageHeight ?? null,
  );

  if (opacity <= 0 && !visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: MAGNIFIER_WIDTH,
        pointerEvents: 'none',
        opacity,
        transition: opacity > 0 ? `opacity ${FADE_DURATION_MS}ms ease` : undefined,
        zIndex: 10,
      }}
    >
      {/* 图片预览 */}
      <div style={{
        width: MAGNIFIER_WIDTH,
        height: position.imageHeight,
        overflow: 'hidden',
        borderRadius: '8px 8px 0 0',
        backgroundColor: '#1a1a2e',
      }}>
        {/* 缩略图占位 */}
        {thumbnailUrl && !imageLoaded && (
          <img
            src={thumbnailUrl}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: 'blur(2px)',
              opacity: 0.6,
            }}
          />
        )}
        {/* Medium 质量大图 */}
        {imageUrl && (
          <img
            ref={imageRef}
            src={imageUrl}
            alt={fileName}
            onLoad={handleImageLoad}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: imageLoaded ? 'block' : 'none',
            }}
          />
        )}
      </div>

      {/* 信息面板 */}
      <div style={{
        padding: '8px 12px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '0 0 8px 8px',
        fontSize: '12px',
        color: '#374151',
        lineHeight: 1.5,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}>
        {/* 文件名 */}
        {fileName && (
          <div style={{ fontWeight: 600, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fileName}
          </div>
        )}
        {/* 拍摄参数 */}
        {meta && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', color: '#6B7280' }}>
            {meta.fNumber != null && <span>f/{meta.fNumber}</span>}
            {meta.exposureTime != null && <span>{meta.exposureTime}</span>}
            {meta.isoSpeed != null && <span>ISO {meta.isoSpeed}</span>}
            {meta.focalLength != null && <span>{meta.focalLength}mm</span>}
          </div>
        )}
        {/* 合焦评分 */}
        {meta?.focusScore != null && (
          <div style={{ marginTop: '2px' }}>
            <span style={{ color: FOCUS_SCORE_COLORS[meta.focusScore] ?? '#666' }}>
              {'\u2605'.repeat(meta.focusScore)}{'\u2606'.repeat(5 - meta.focusScore)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 位置计算 ─────────────────────────────────────────

function calculatePosition(
  mouseX: number,
  mouseY: number,
  viewportWidth: number,
  viewportHeight: number,
  imageWidth: number | null,
  imageHeight: number | null,
): { x: number; y: number; imageHeight: number } {
  // 计算图片显示高度
  let imageDisplayHeight: number;
  if (imageWidth && imageHeight && imageWidth > 0) {
    imageDisplayHeight = (MAGNIFIER_WIDTH / imageWidth) * imageHeight;
    // 纵向图片最大高度限制
    imageDisplayHeight = Math.min(imageDisplayHeight, viewportHeight * 0.8);
  } else {
    imageDisplayHeight = MAGNIFIER_WIDTH * 2 / 3; // 默认 3:2
  }

  // 估算信息面板高度
  const infoHeight = 60;
  const totalHeight = imageDisplayHeight + infoHeight;

  let x: number;
  let y: number;

  // 默认右侧显示
  if (mouseX + MAGNIFIER_OFFSET_X + MAGNIFIER_WIDTH + MAGNIFIER_OFFSET_X < viewportWidth) {
    x = mouseX + MAGNIFIER_OFFSET_X;
  } else {
    // 右侧空间不足，翻转到左侧
    x = mouseX - MAGNIFIER_WIDTH - MAGNIFIER_OFFSET_X;
  }

  // 垂直偏移：默认鼠标上方
  y = mouseY - MAGNIFIER_OFFSET_Y - imageDisplayHeight;

  // 上下边界自适应
  if (y < 0) {
    y = mouseY + MAGNIFIER_OFFSET_Y;
  }
  if (y + totalHeight > viewportHeight) {
    y = viewportHeight - totalHeight;
  }
  if (y < 0) {
    y = 0;
  }

  // 左侧越界保护
  if (x < 0) x = 0;
  if (x + MAGNIFIER_WIDTH > viewportWidth) {
    x = viewportWidth - MAGNIFIER_WIDTH;
  }

  return { x, y, imageHeight: imageDisplayHeight };
}
