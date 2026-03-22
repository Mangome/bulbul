// ============================================================
// 通用 Badge 组件
//
// Pill 形状数字/文本标签，支持不同颜色变体。
// ============================================================

import { type CSSProperties, type ReactNode } from 'react';

// ─── 类型 ─────────────────────────────────────────────

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  style?: CSSProperties;
}

// ─── 样式映射 ─────────────────────────────────────────

const variantStyles: Record<BadgeVariant, CSSProperties> = {
  default: {
    background: 'rgba(0, 0, 0, 0.08)',
    color: '#374151',
  },
  primary: {
    background: '#3B82F6',
    color: '#FFFFFF',
  },
  success: {
    background: '#10B981',
    color: '#FFFFFF',
  },
  warning: {
    background: '#F59E0B',
    color: '#FFFFFF',
  },
};

const baseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1px 7px',
  fontSize: '11px',
  fontWeight: 600,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  borderRadius: '999px',
  lineHeight: '18px',
  minWidth: '18px',
  whiteSpace: 'nowrap',
  userSelect: 'none',
};

// ─── 组件 ─────────────────────────────────────────────

export function Badge({
  variant = 'default',
  children,
  style,
}: BadgeProps) {
  return (
    <span
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
