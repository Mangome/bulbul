// ============================================================
// 通用 Badge 组件
//
// Pill 形状数字/文本标签，支持不同颜色变体。
// ============================================================

import { type CSSProperties, type ReactNode } from 'react';

import cls from './Badge.module.css';

// ─── 类型 ─────────────────────────────────────────────

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  style?: CSSProperties;
}

// ─── 组件 ─────────────────────────────────────────────

export function Badge({
  variant = 'default',
  children,
  style,
}: BadgeProps) {
  return (
    <span
      className={`${cls.badge} ${cls[variant]}`}
      style={style}
    >
      {children}
    </span>
  );
}
