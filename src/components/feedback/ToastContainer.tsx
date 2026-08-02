import { AnimatePresence, motion } from 'motion/react';
import { useToastStore } from '../../stores/useToastStore';
import { DURATION, EASE } from '../../utils/motionTokens';
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
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: DURATION.fast, ease: EASE.standard } }}
            transition={{ duration: DURATION.normal, ease: EASE.outQuint }}
          >
            <Toast toast={toast} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
