import { motion, AnimatePresence } from 'motion/react';
import type { ExportProgress } from '../../services/exportService';
import { formatDuration } from '../../utils/format';
import cls from './ExportProgressDialog.module.css';

interface ExportProgressDialogProps {
  progress: ExportProgress | null;
}

const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

export function ExportProgressDialog({ progress }: ExportProgressDialogProps) {
  const percent = progress ? (progress.total > 0 ? (progress.current / progress.total) * 100 : 0) : 0;
  const current = progress?.current ?? 0;
  const total = progress?.total ?? 0;
  const currentFile = progress?.currentFile;
  const elapsedMs = progress?.elapsedMs;

  return (
    <AnimatePresence>
      {progress !== null && (
        <motion.div
          className={cls.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT_QUART }}
        >
          <motion.div
            className={cls.dialog}
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.24, ease: EASE_OUT_QUART }}
          >
            <div className={cls.title}>正在导出...</div>

            <div className={cls.percentText}>{percent.toFixed(1)}%</div>

            <p className={cls.countText}>
              {current} / {total}
            </p>

            <div className={cls.progressBarBg}>
              <div
                className={cls.progressBarFill}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>

            <div className={cls.detailSection}>
              {currentFile && (
                <p className={cls.fileText} title={currentFile}>
                  {currentFile}
                </p>
              )}
              {elapsedMs != null && (
                <span className={cls.timeText}>
                  已用 {formatDuration(elapsedMs)}
                </span>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
