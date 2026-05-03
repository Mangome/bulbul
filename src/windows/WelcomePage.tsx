import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { getCurrentWindow } from '@tauri-apps/api/window';
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

  const handleClose = () => {
    getCurrentWindow().close();
  };

  const handleSelectFolder = async () => {
    try {
      setLoading(true);
      setError(null);

      const folderPath = await selectFolder();
      if (!folderPath) {
        setLoading(false);
        return;
      }

      await invoke('open_main_window', { folderPath });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  return (
    <div className={cls.window}>
      {/* 全出血 Logo 底图 */}
      <img
        src={appIcon}
        alt=""
        className={cls.logo}
        draggable={false}
      />

      {/* 拖拽区域 - 覆盖上半部分 */}
      <div className={cls.dragRegion} data-tauri-drag-region />

      {/* 关闭按钮 */}
      <button
        className={cls.closeBtn}
        onClick={handleClose}
        aria-label="关闭"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M1 1L9 9M9 1L1 9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* 主交互区 */}
      <div className={cls.actions}>
        <button
          className={`${cls.openBtn} ${loading ? cls.openBtnDisabled : ''}`}
          onClick={handleSelectFolder}
          disabled={loading}
          aria-busy={loading}
          aria-label="选择图片文件夹以开始筛选"
        >
          <span className={cls.openBtnLabel}>
            {loading ? '正在打开…' : '选择文件夹'}
          </span>
          {!loading && (
            <svg
              className={cls.openBtnArrow}
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
      </div>

      {/* 错误提示 */}
      {error && (
        <p className={cls.error} role="alert">
          {error}
        </p>
      )}

      {/* 版本号水印 */}
      {version && (
        <span className={cls.version} aria-hidden="true">
          v{version}
        </span>
      )}
    </div>
  );
}

export default WelcomePage;
