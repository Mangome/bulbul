import { useEffect, useRef, useCallback } from 'react';
import type { ToastItem, ToastType } from '../../stores/useToastStore';
import { useToastStore } from '../../stores/useToastStore';
import styles from './Toast.module.css';

// ─── SVG 图标 ────────────────────────────────────────

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2.5 6.2L5 8.5l4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCross() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 3v3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="6" cy="8.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="6" cy="3.2" r="0.9" fill="currentColor" />
      <path d="M6 5.5v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <IconCheck />,
  error: <IconCross />,
  warning: <IconWarning />,
  info: <IconInfo />,
};

const ROLE_LABELS: Record<ToastType, string> = {
  success: '成功',
  error: '错误',
  warning: '警告',
  info: '提示',
};

interface ToastProps {
  toast: ToastItem;
}

export function Toast({ toast }: ToastProps) {
  const removeToast = useToastStore((s) => s.removeToast);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(toast.duration);
  const startRef = useRef(Date.now());

  const startTimer = useCallback(() => {
    startRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      removeToast(toast.id);
    }, remainingRef.current);
  }, [removeToast, toast.id]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      const elapsed = Date.now() - startRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    }
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [startTimer]);

  const handleClose = () => {
    removeToast(toast.id);
  };

  return (
    <div
      className={`${styles.toast} ${styles[toast.type]}`}
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
      onFocus={pauseTimer}
      onBlur={startTimer}
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
    >
      <span className={styles.icon} aria-hidden="true">
        {ICONS[toast.type]}
      </span>
      <div className={styles.content}>
        <p className={styles.message}>
          <span className={styles.srOnly}>{ROLE_LABELS[toast.type]}：</span>
          {toast.message}
        </p>
      </div>
      <button className={styles.closeBtn} onClick={handleClose} aria-label="关闭">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
