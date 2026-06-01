// ============================================================
// 纵向滚动条 (Scrollbar) — InfiniteCanvas 自定义滚动条
//
// 渲染一个绝对定位的纵向滚动条，位于画布容器右侧。
// 支持拖拽滑块和点击轨道两种交互方式。
//
// 与 InfiniteCanvas 的自定义滚动引擎配合使用：
// - 读取 useCanvasStore.viewportY 获取当前滚动位置
// - 通过 onScrollToY 回调驱动画布滚动
// ============================================================

import { useRef, useCallback, useEffect, useState } from 'react';
import { useCanvasStore } from '../../stores/useCanvasStore';
import styles from './Scrollbar.module.css';

// ─── 常量 ─────────────────────────────────────────────

/** 滑块最小高度 (px)，防止内容极多时滑块过小难以操作 */
const MIN_THUMB_HEIGHT = 32;

// ─── Props ────────────────────────────────────────────

interface ScrollbarProps {
  /** 内容总高度（CSS 像素，不含 paddingTop） */
  contentHeight: number;
  /** 内容顶部内边距，用于计算可滚动总高度 */
  paddingTop: number;
  /** 滚动回调：目标 Y 坐标（内容坐标系） */
  onScrollToY: (y: number) => void;
}

// ─── Component ────────────────────────────────────────

export function Scrollbar({ contentHeight, paddingTop, onScrollToY }: ScrollbarProps) {
  const viewportY = useCanvasStore((s) => s.viewportY);
  const trackRef = useRef<HTMLDivElement>(null);

  const [viewportHeight, setViewportHeight] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dragStartRef = useRef({ y: 0, scrollY: 0 });

  // ── 监听轨道高度变化 ──
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect.height;
        if (h > 0) setViewportHeight(h);
      }
    });
    observer.observe(track);

    // 初始测量
    const h = track.clientHeight;
    if (h > 0) setViewportHeight(h);

    return () => observer.disconnect();
  }, []);

  // ── 几何计算 ──
  const totalHeight = contentHeight + paddingTop;
  const maxScrollY = Math.max(0, totalHeight - viewportHeight);

  const thumbHeight = viewportHeight > 0
    ? Math.max(MIN_THUMB_HEIGHT, (viewportHeight / totalHeight) * viewportHeight)
    : MIN_THUMB_HEIGHT;

  const thumbTravel = viewportHeight - thumbHeight;
  const thumbTop = maxScrollY > 0 && thumbTravel > 0
    ? (viewportY / maxScrollY) * thumbTravel
    : 0;

  // ── 点击轨道：跳转到对应位置 ──
  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) return;
      const track = trackRef.current;
      if (!track || thumbTravel <= 0) return;

      const rect = track.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const ratio = (clickY - thumbHeight / 2) / thumbTravel;
      const targetScrollY = ratio * maxScrollY;
      onScrollToY(Math.max(0, Math.min(targetScrollY, maxScrollY)));
    },
    [isDragging, thumbHeight, thumbTravel, maxScrollY, onScrollToY],
  );

  // ── 拖拽滑块 ──
  const handleThumbMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = { y: e.clientY, scrollY: viewportY };
    },
    [viewportY],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const track = trackRef.current;
      if (!track || thumbTravel <= 0) return;

      const dy = e.clientY - dragStartRef.current.y;
      const scrollDy = (dy / thumbTravel) * maxScrollY;
      const targetScrollY = dragStartRef.current.scrollY + scrollDy;
      onScrollToY(Math.max(0, Math.min(targetScrollY, maxScrollY)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, thumbTravel, maxScrollY, onScrollToY]);

  // ── 内容未超出视口时隐藏滚动条 ──
  if (maxScrollY <= 0) return null;

  // ── 轨道 hover 判断（扩大点击区域用） ──
  const isActive = isDragging || isHovered;

  return (
    <div
      className={styles.scrollbar}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        ref={trackRef}
        className={styles.track}
        onClick={handleTrackClick}
      >
        <div
          className={`${styles.thumb} ${isActive ? styles.thumbVisible : ''} ${isDragging ? styles.thumbDragging : ''}`}
          style={{
            height: `${thumbHeight}px`,
            transform: `translateY(${thumbTop}px)`,
          }}
          onMouseDown={handleThumbMouseDown}
        />
      </div>
    </div>
  );
}
