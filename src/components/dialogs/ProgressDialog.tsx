import type { ProcessingProgress, ProcessingState } from '../../types';
import { formatDuration } from '../../utils/format';

/** 阶段标签映射 */
const stateLabels: Record<string, string> = {
  scanning: '扫描文件中...',
  processing: '处理图片中...',
  analyzing: '分析相似度中...',
  grouping: '分组中...',
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
  // 不显示条件
  if (processingState === 'idle' || processingState === 'completed') {
    return null;
  }

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

  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        {/* 阶段标签 */}
        <h3 style={styles.stageLabel}>{label}</h3>

        {/* 进度计数 */}
        {total > 0 && (
          <p style={styles.countText}>
            {current} / {total}（{percent.toFixed(1)}%）
          </p>
        )}

        {/* 当前文件名 */}
        {currentFile && (
          <p style={styles.fileText} title={currentFile}>
            {currentFile}
          </p>
        )}

        {/* 进度条 */}
        <div style={styles.progressBarBg}>
          <div
            style={{
              ...styles.progressBarFill,
              width: `${Math.min(percent, 100)}%`,
            }}
          />
        </div>

        {/* 时间信息 */}
        <div style={styles.timeRow}>
          {elapsedMs != null && (
            <span style={styles.timeText}>
              已用 {formatDuration(elapsedMs)}
            </span>
          )}
          {estimatedRemainingMs != null && estimatedRemainingMs > 0 && (
            <span style={styles.timeText}>
              预计剩余 {formatDuration(estimatedRemainingMs)}
            </span>
          )}
        </div>

        {/* 取消按钮 */}
        {isActive && (
          <button style={styles.cancelButton} onClick={onCancel}>
            取消
          </button>
        )}
      </div>
    </div>
  );
}

// ─── 样式 ─────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  dialog: {
    background: 'var(--color-bg-primary, #1e1e1e)',
    border: '1px solid var(--color-border, #333)',
    borderRadius: '8px',
    padding: '24px 32px',
    minWidth: '360px',
    maxWidth: '480px',
    textAlign: 'center' as const,
  },
  stageLabel: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--color-text-primary, #e0e0e0)',
    margin: '0 0 12px',
  },
  countText: {
    fontSize: '14px',
    color: 'var(--color-text-secondary, #aaa)',
    margin: '0 0 8px',
  },
  fileText: {
    fontSize: '12px',
    color: 'var(--color-text-muted, #777)',
    margin: '0 0 12px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  progressBarBg: {
    height: '6px',
    borderRadius: '3px',
    background: 'var(--color-border, #333)',
    overflow: 'hidden',
    marginBottom: '12px',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: '3px',
    background: 'var(--color-primary, #4a9eff)',
    transition: 'width 0.3s ease',
  },
  timeRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    marginBottom: '16px',
  },
  timeText: {
    fontSize: '12px',
    color: 'var(--color-text-muted, #777)',
  },
  cancelButton: {
    padding: '6px 20px',
    fontSize: '13px',
    color: 'var(--color-danger, #ff4d4f)',
    background: 'transparent',
    border: '1px solid var(--color-danger, #ff4d4f)',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};
