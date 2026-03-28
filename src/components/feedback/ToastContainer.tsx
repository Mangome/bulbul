import { AnimatePresence, motion } from 'motion/react';
import { useToastStore } from '../../stores/useToastStore';
import { Toast } from './Toast';

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  top: 16,
  right: 16,
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  pointerEvents: 'none',
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div style={containerStyle} aria-live="polite" aria-relevant="additions removals">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Toast toast={toast} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
