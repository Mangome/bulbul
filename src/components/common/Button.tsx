// ============================================================
// 通用按钮组件
//
// 支持 variant（primary/secondary/ghost）、size（sm/md）、
// disabled 状态和 onClick 回调。使用 CSS Module + CSS 变量。
// ============================================================

import { type CSSProperties, type ReactNode, useCallback } from 'react';

import styles from './Button.module.css';

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

// ─── 组件 ─────────────────────────────────────────────

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  children,
  style,
}: ButtonProps) {
  const handleClick = useCallback(() => {
    if (!disabled && onClick) {
      onClick();
    }
  }, [disabled, onClick]);

  const className = [
    styles.btn,
    styles[variant],
    styles[size],
    disabled ? styles.disabled : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={className}
      disabled={disabled}
      onClick={handleClick}
      style={style}
    >
      {children}
    </button>
  );
}
