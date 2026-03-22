import { useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../stores/useAppStore';
import * as processService from '../services/processService';
import type { ProcessingProgress, ProcessingState } from '../types';

function MainPage() {
  const {
    currentFolder,
    processingState,
    progress,
    setFolder,
    setProcessingState,
    updateProgress,
  } = useAppStore();

  const unlistenRefs = useRef<Array<(() => void)>>([]);

  // 获取当前文件夹并自动触发处理
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const folder = await invoke<string | null>('get_current_folder');
        if (cancelled || !folder) return;

        // 获取文件夹信息
        const info = await invoke<{
          path: string;
          name: string;
          fileCount: number;
          rawCount: number;
        }>('get_folder_info', { path: folder });

        if (cancelled) return;
        setFolder(folder, info);

        // 自动触发处理
        setProcessingState('processing');
        await processService.processFolder(folder);
      } catch (err) {
        if (!cancelled) {
          console.error('处理初始化失败:', err);
          setProcessingState('error');
        }
      }
    };

    init();
    return () => { cancelled = true; };
  }, [setFolder, setProcessingState]);

  // 注册事件监听
  useEffect(() => {
    const setupListeners = async () => {
      const unlistenProgress = await processService.onProgress(
        (prog: ProcessingProgress) => {
          updateProgress(prog);
          setProcessingState(prog.state);
        },
      );

      const unlistenCompleted = await processService.onCompleted(() => {
        setProcessingState('completed');
      });

      const unlistenFailed = await processService.onFailed((error: string) => {
        console.error('处理失败:', error);
        setProcessingState('error');
      });

      unlistenRefs.current = [unlistenProgress, unlistenCompleted, unlistenFailed];
    };

    setupListeners();

    return () => {
      for (const unlisten of unlistenRefs.current) {
        unlisten();
      }
      unlistenRefs.current = [];
    };
  }, [updateProgress, setProcessingState]);

  const handleCancel = useCallback(async () => {
    try {
      await processService.cancelProcessing();
      setProcessingState('cancelling');
    } catch (err) {
      console.error('取消失败:', err);
    }
  }, [setProcessingState]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Bulbul 主工作区</h1>
        <p style={styles.subtitle}>
          {currentFolder
            ? `文件夹: ${currentFolder}`
            : '等待加载文件夹...'}
        </p>
      </div>

      {/* 进度区域 */}
      <ProcessingStatus
        state={processingState}
        progress={progress}
        onCancel={handleCancel}
      />

      <div style={styles.placeholder}>
        <p style={styles.placeholderText}>
          🖼️ PixiJS 画布区域（Stage 4 实现）
        </p>
      </div>
    </div>
  );
}

// ─── 进度展示组件 ────────────────────────────────────────

interface ProcessingStatusProps {
  state: ProcessingState;
  progress: ProcessingProgress | null;
  onCancel: () => void;
}

function ProcessingStatus({ state, progress, onCancel }: ProcessingStatusProps) {
  if (state === 'idle' || state === 'completed') {
    return state === 'completed' ? (
      <div style={styles.statusBar}>
        <span style={styles.statusText}>
          ✅ 处理完成
          {progress ? ` — 共 ${progress.total} 张` : ''}
        </span>
      </div>
    ) : null;
  }

  const stateLabels: Record<string, string> = {
    scanning: '🔍 扫描文件中...',
    processing: '⚙️ 处理图片中...',
    analyzing: '📊 分析中...',
    grouping: '📁 分组中...',
    cancelling: '⏳ 正在取消...',
    cancelled: '❌ 已取消',
    error: '⚠️ 处理出错',
  };

  const label = stateLabels[state] || state;
  const percent = progress?.progressPercent ?? 0;
  const currentFile = progress?.currentFile;
  const current = progress?.current ?? 0;
  const total = progress?.total ?? 0;

  const isActive = state === 'scanning' || state === 'processing' || state === 'analyzing' || state === 'grouping';

  return (
    <div style={styles.statusBar}>
      <div style={styles.statusContent}>
        <span style={styles.statusText}>{label}</span>
        {total > 0 && (
          <span style={styles.statusCount}>
            {current}/{total}（{percent.toFixed(1)}%）
          </span>
        )}
        {currentFile && (
          <span style={styles.statusFile}>{currentFile}</span>
        )}
      </div>

      {/* 进度条 */}
      {total > 0 && (
        <div style={styles.progressBarBg}>
          <div
            style={{
              ...styles.progressBarFill,
              width: `${Math.min(percent, 100)}%`,
            }}
          />
        </div>
      )}

      {/* 取消按钮 */}
      {isActive && (
        <button style={styles.cancelButton} onClick={onCancel}>
          取消
        </button>
      )}
    </div>
  );
}

// ─── 样式 ─────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: 'var(--color-bg-primary)',
  },
  header: {
    padding: 'var(--spacing-md) var(--spacing-lg)',
    borderBottom: '1px solid var(--color-border)',
  },
  title: {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  subtitle: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-muted)',
    margin: '4px 0 0',
    wordBreak: 'break-all' as const,
  },
  statusBar: {
    padding: '12px var(--spacing-lg)',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-bg-secondary)',
  },
  statusContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '6px',
    flexWrap: 'wrap' as const,
  },
  statusText: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  statusCount: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
  },
  statusFile: {
    fontSize: 'var(--font-size-xs, 11px)',
    color: 'var(--color-text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    maxWidth: '300px',
  },
  progressBarBg: {
    height: '4px',
    borderRadius: '2px',
    background: 'var(--color-border)',
    overflow: 'hidden',
    marginBottom: '6px',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: '2px',
    background: 'var(--color-primary)',
    transition: 'width 0.3s ease',
  },
  cancelButton: {
    padding: '4px 12px',
    fontSize: 'var(--font-size-xs, 11px)',
    color: 'var(--color-danger)',
    background: 'transparent',
    border: '1px solid var(--color-danger)',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  placeholder: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-bg-secondary)',
  },
  placeholderText: {
    fontSize: 'var(--font-size-lg)',
    color: 'var(--color-text-muted)',
  },
};

export default MainPage;
