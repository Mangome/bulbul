import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { selectFolder } from '../services/fileService';
import appIcon from '../assets/app-icon.png';
import cls from './WelcomePage.module.css';

function WelcomePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState('');

  useEffect(() => {
    getVersion().then(setVersion);
  }, []);

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
    <div className={cls.container}>
      {/* 背景装饰层 */}
      <div className={cls.backdrop} aria-hidden="true">
        <div className={cls.glow} />
        <div className={cls.dots} />
        <div className={cls.beam} />
      </div>

      <main className={cls.content}>
        <div className={cls.iconWrap}>
          <div className={cls.iconHalo} aria-hidden="true" />
          <img src={appIcon} alt="" className={cls.icon} draggable={false} />
        </div>

        <h1 className={cls.title}>Bulbul</h1>

        <p className={cls.tagline}>
          <span className={cls.taglineZh}>连拍一时爽，选片一直爽！</span>
          <span className={cls.taglineEn}>Burst freely, pick easily.</span>
        </p>

        <div className={cls.meta} aria-hidden="true">
          <span className={cls.metaDot} />
          <span className={cls.metaText}>智能分组 · 极速预览 · 专注选片</span>
          <span className={cls.metaDot} />
        </div>

        <button
          className={`${cls.button} ${loading ? cls.buttonDisabled : ''}`}
          onClick={handleSelectFolder}
          disabled={loading}
          aria-busy={loading}
          aria-label="选择图片文件夹以开始筛选"
        >
          <span className={cls.buttonLabel}>
            {loading ? '正在打开…' : '选择文件夹'}
          </span>
          {!loading && (
            <svg
              className={cls.buttonArrow}
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 7h8m0 0L7.5 3.5M11 7L7.5 10.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        {error && (
          <p className={cls.error} role="alert">
            {error}
          </p>
        )}
      </main>

      {version && (
        <footer className={cls.footer} aria-hidden="true">
          <span className={cls.footerVersion}>v{version}</span>
        </footer>
      )}
    </div>
  );
}

export default WelcomePage;
