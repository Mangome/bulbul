import { motion, AnimatePresence } from 'motion/react';
import type { ProcessingProgress, ProcessingState } from '../../types';
import { formatDuration } from '../../utils/format';
import cls from './ProgressDialog.module.css';

/** 阶段标签映射 */
const stateLabels: Record<string, string> = {
  scanning: '扫描文件中...',
  processing: '处理图片中...',
  analyzing: '分析相似度中...',
  grouping: '分组中...',
  focus_scoring: '计算合焦程度中...',
  cancelling: '正在取消...',
  cancelled: '已取消',
  error: '处理出错',
};

interface ProgressDialogProps {
  processingState: ProcessingState;
  progress: ProcessingProgress | null;
  onCancel: () => void;
}

/**
 * 模态进度对话框
 *
 * 显示条件：processingState 非 idle 且非 completed
 */
export function ProgressDialog({ processingState, progress, onCancel }: ProgressDialogProps) {
  const visible = processingState !== 'idle' && processingState !== 'completed';

  const label = stateLabels[processingState] || processingState;
  const percent = progress?.progressPercent ?? 0;
  const current = progress?.current ?? 0;
  const total = progress?.total ?? 0;
  const currentFile = progress?.currentFile;
  const elapsedMs = progress?.elapsedMs;
  const estimatedRemainingMs = progress?.estimatedRemainingMs;

  const isActive =
    processingState === 'scanning' ||
    processingState === 'processing' ||
    processingState === 'analyzing' ||
    processingState === 'grouping';

  // 自然减速曲线（easeOutQuart / easeOutQuint 的贝塞尔近似）
  const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

  return (
    <AnimatePresence>
      {visible && (
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
            {/* 阶段标签 + spinner */}
            <div className={cls.stageRow}>
              {isActive && <span className={cls.spinner} />}
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={label}
                  className={cls.stageLabel}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: EASE_OUT_QUART }}
                >
                  {label}
                </motion.span>
              </AnimatePresence>
            </div>

            {/* 百分比大字 */}
            {total > 0 && (
              <div className={cls.percentText}>{percent.toFixed(1)}%</div>
            )}

            {/* 进度计数 */}
            {total > 0 && (
              <p className={cls.countText}>
                {current} / {total}
              </p>
            )}

            {/* 进度条 */}
            <div className={cls.progressBarBg}>
              <div
                className={cls.progressBarFill}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>

            {/* 辅助信息区 */}
            <div className={cls.detailSection}>
              {currentFile && (
                <p className={cls.fileText} title={currentFile}>
                  {currentFile}
                </p>
              )}
              <div className={cls.timeRow}>
                {elapsedMs != null && (
                  <span className={cls.timeText}>
                    已用 {formatDuration(elapsedMs)}
                  </span>
                )}
                {elapsedMs != null && estimatedRemainingMs != null && estimatedRemainingMs > 0 && (
                  <span className={cls.timeSeparator}>&middot;</span>
                )}
                {estimatedRemainingMs != null && estimatedRemainingMs > 0 && (
                  <span className={cls.timeText}>
                    预计剩余 {formatDuration(estimatedRemainingMs)}
                  </span>
                )}
              </div>
            </div>

            {/* 取消按钮 */}
            {isActive && (
              <button className={cls.cancelButton} onClick={onCancel}>
                取消
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
