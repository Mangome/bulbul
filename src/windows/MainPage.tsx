import { useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../stores/useAppStore';
import { useProcessing } from '../hooks/useProcessing';
import { ProgressDialog } from '../components/dialogs/ProgressDialog';

function MainPage() {
  const {
    currentFolder,
    processingState,
    progress,
    setFolder,
  } = useAppStore();

  const { startProcessing, cancelProcessing } = useProcessing();

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
        await startProcessing(folder);
      } catch (err) {
        if (!cancelled) {
          console.error('处理初始化失败:', err);
        }
      }
    };

    init();
    return () => { cancelled = true; };
  }, [setFolder, startProcessing]);

  const handleCancel = useCallback(async () => {
    await cancelProcessing();
  }, [cancelProcessing]);

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

      {/* 完成状态摘要 */}
      {processingState === 'completed' && progress && (
        <div style={styles.statusBar}>
          <span style={styles.statusText}>
            ✅ 处理完成 — 共 {progress.total} 张
          </span>
        </div>
      )}

      {/* 进度对话框（模态） */}
      <ProgressDialog
        processingState={processingState}
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
  statusText: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
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
