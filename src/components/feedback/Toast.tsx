import { useEffect, useRef, useCallback } from 'react';
import type { ToastItem, ToastType } from '../../stores/useToastStore';
import { useToastStore } from '../../stores/useToastStore';
import styles from './Toast.module.css';

const ICONS: Record<ToastType, string> = {
  success: '\u2714',  // ✔
  error: '\u2716',    // ✖
  warning: '\u26A0',  // ⚠
  info: '\u2139',     // ℹ
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
      role="alert"
    >
      <span className={styles.icon}>{ICONS[toast.type]}</span>
      <div className={styles.content}>
        <p className={styles.message}>{toast.message}</p>
      </div>
      <button className={styles.closeBtn} onClick={handleClose} aria-label="关闭">
        \u2715
      </button>
    </div>
  );
}
