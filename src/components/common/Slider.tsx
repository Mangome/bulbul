// ============================================================
// 通用滑块组件
//
// 支持 min/max/value/step/onChange 受控模式。
// 使用 inline style 实现自定义外观。
// ============================================================

import { type CSSProperties, useCallback, useRef } from 'react';

// ─── 类型 ─────────────────────────────────────────────

export interface SliderProps {
  min: number;
  max: number;
  value: number;
  step?: number;
  onChange: (value: number) => void;
  style?: CSSProperties;
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
      style={{
        position: 'relative',
        width: '100%',
        height: `${THUMB_SIZE}px`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        ...style,
      }}
      onPointerDown={handlePointerDown}
    >
      {/* 轨道背景 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: `${TRACK_HEIGHT}px`,
          borderRadius: `${TRACK_HEIGHT / 2}px`,
          background: 'rgba(0, 0, 0, 0.1)',
        }}
      />
      {/* 已填充轨道 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          width: `${percentage}%`,
          height: `${TRACK_HEIGHT}px`,
          borderRadius: `${TRACK_HEIGHT / 2}px`,
          background: '#3B82F6',
        }}
      />
      {/* 滑块 */}
      <div
        style={{
          position: 'absolute',
          left: `calc(${percentage}% - ${THUMB_SIZE / 2}px)`,
          width: `${THUMB_SIZE}px`,
          height: `${THUMB_SIZE}px`,
          borderRadius: '50%',
          background: '#FFFFFF',
          border: '2px solid #3B82F6',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          transition: 'box-shadow 0.15s',
        }}
      />
    </div>
  );
}
