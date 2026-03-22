import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { selectFolder } from '../services/fileService';

function WelcomePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectFolder = async () => {
    try {
      setLoading(true);
      setError(null);

      const folderPath = await selectFolder();
      if (!folderPath) {
        // 用户取消了选择
        setLoading(false);
        return;
      }

      // 打开主窗口，传入文件夹路径
      await invoke('open_main_window', { folderPath });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>Bulbul</h1>
        <p style={styles.subtitle}>RAW 图像筛选与管理工具</p>
        <p style={styles.description}>
          选择包含 NEF 文件的文件夹，开始智能分组和筛选您的照片。
        </p>

        <button
          style={{
            ...styles.button,
            ...(loading ? styles.buttonDisabled : {}),
          }}
          onClick={handleSelectFolder}
          disabled={loading}
        >
          {loading ? '正在打开...' : '选择文件夹'}
        </button>

        {error && <p style={styles.error}>{error}</p>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    padding: 'var(--spacing-xl)',
    background: 'var(--color-bg-primary)',
  },
  content: {
    textAlign: 'center',
    maxWidth: 400,
  },
  title: {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 700,
    color: 'var(--color-primary)',
    marginBottom: 'var(--spacing-sm)',
  },
  subtitle: {
    fontSize: 'var(--font-size-lg)',
    color: 'var(--color-text-secondary)',
    marginBottom: 'var(--spacing-md)',
  },
  description: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-muted)',
    marginBottom: 'var(--spacing-xl)',
    lineHeight: 1.6,
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 32px',
    fontSize: 'var(--font-size-md)',
    fontWeight: 600,
    color: '#FFFFFF',
    backgroundColor: 'var(--color-primary)',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    transition: 'var(--transition-fast)',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  error: {
    marginTop: 'var(--spacing-md)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-danger)',
  },
};

export default WelcomePage;
