import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (params: { type: ToastType; message: string; duration?: number }) => string;
  removeToast: (id: string) => void;
}

const MAX_TOASTS = 5;
let nextId = 1;

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3000,
  info: 3000,
  error: 5000,
  warning: 5000,
};

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: ({ type, message, duration }) => {
    const id = String(nextId++);
    const toast: ToastItem = {
      id,
      type,
      message,
      duration: duration ?? DEFAULT_DURATION[type],
    };

    set((state) => {
      const updated = [toast, ...state.toasts];
      // 超过上限时移除最早的
      if (updated.length > MAX_TOASTS) {
        return { toasts: updated.slice(0, MAX_TOASTS) };
      }
      return { toasts: updated };
    });

    return id;
  },

  removeToast: (id: string) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
