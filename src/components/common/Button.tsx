// ============================================================
// 通用按钮组件
//
// 支持 variant（primary/secondary/ghost）、size（sm/md）、
// disabled 状态和 onClick 回调。使用 inline style + CSS 变量。
// ============================================================

import { type CSSProperties, type ReactNode, useCallback, useState } from 'react';

// ─── 类型 ─────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  style?: CSSProperties;
}

// ─── 样式映射 ─────────────────────────────────────────

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: '#3B82F6',
    color: '#FFFFFF',
    border: 'none',
  },
  secondary: {
    background: 'rgba(0, 0, 0, 0.06)',
    color: '#1F2937',
    border: '1px solid rgba(0, 0, 0, 0.1)',
  },
  ghost: {
    background: 'transparent',
    color: '#374151',
    border: 'none',
  },
};

const sizeStyles: Record<ButtonSize, CSSProperties> = {
  sm: {
    padding: '4px 10px',
    fontSize: '12px',
    borderRadius: '6px',
    minHeight: '28px',
  },
  md: {
    padding: '6px 14px',
    fontSize: '13px',
    borderRadius: '8px',
    minHeight: '32px',
  },
};

const baseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  fontWeight: 500,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  cursor: 'pointer',
  transition: 'background 0.15s, opacity 0.15s',
  whiteSpace: 'nowrap',
  userSelect: 'none',
  lineHeight: 1,
};

const disabledStyle: CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed',
};

// ─── 组件 ─────────────────────────────────────────────

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  children,
  style,
}: ButtonProps) {
  const [hovered, setHovered] = useState(false);

  const handleClick = useCallback(() => {
    if (!disabled && onClick) {
      onClick();
    }
  }, [disabled, onClick]);

  const hoverStyle: CSSProperties =
    hovered && !disabled
      ? variant === 'primary'
        ? { background: '#2563EB' }
        : variant === 'ghost'
          ? { background: 'rgba(0, 0, 0, 0.06)' }
          : { background: 'rgba(0, 0, 0, 0.1)' }
      : {};

  const composedStyle: CSSProperties = {
    ...baseStyle,
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...(disabled ? disabledStyle : {}),
    ...hoverStyle,
    ...style,
  };

  return (
    <button
      style={composedStyle}
      disabled={disabled}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  );
}
