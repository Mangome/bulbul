// ============================================================
// 通用滑块组件
//
// 支持 min/max/value/step/onChange 受控模式。
// 使用 CSS Module 实现自定义外观。
// ============================================================

import { type CSSProperties, useCallback, useRef } from 'react';

import cls from './Slider.module.css';

// ─── 类型 ─────────────────────────────────────────────

export interface SliderProps {
  min: number;
  max: number;
  value: number;
  step?: number;
  onChange: (value: number) => void;
  style?: CSSProperties;
  'aria-label'?: string;
}

// ─── 常量 ─────────────────────────────────────────────

const TRACK_HEIGHT = 4;
const THUMB_SIZE = 14;

// ─── 组件 ─────────────────────────────────────────────

export function Slider({
  min,
  max,
  value,
  step = 1,
  onChange,
  style,
  'aria-label': ariaLabel,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const ratio = max > min ? (value - min) / (max - min) : 0;
  const percentage = Math.min(1, Math.max(0, ratio)) * 100;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const track = trackRef.current;
      if (!track) return;

      const updateValue = (clientX: number) => {
        const rect = track.getBoundingClientRect();
        const rawRatio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        const rawValue = min + rawRatio * (max - min);
        const steppedValue = Math.round(rawValue / step) * step;
        const clamped = Math.min(max, Math.max(min, steppedValue));
        onChange(clamped);
      };

      updateValue(e.clientX);

      const handleMove = (ev: PointerEvent) => updateValue(ev.clientX);
      const handleUp = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    },
    [min, max, step, onChange],
  );

  return (
    <div
      ref={trackRef}
      className={cls.container}
      style={style}
      onPointerDown={handlePointerDown}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
    >
      {/* 轨道背景 */}
      <div className={cls.trackBg} />
      {/* 已填充轨道 */}
      <div className={cls.trackFill} style={{ width: `${percentage}%` }} />
      {/* 滑块 */}
      <div className={cls.thumb} style={{ left: `calc(${percentage}% - ${THUMB_SIZE / 2}px)` }} />
    </div>
  );
}
