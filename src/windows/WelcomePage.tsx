import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { selectFolder } from '../services/fileService';
import appIcon from '../assets/app-icon.png';
import cls from './WelcomePage.module.css';

/** 将 Rust 错误字符串转为用户可读的中文提示 */
function friendlyError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('not a directory') || lower.includes('不是目录') || lower.includes('目录名称无效')) {
    return '请选择文件夹，而非单个文件';
  }
  if (lower.includes('no such file') || lower.includes('找不到') || lower.includes('does not exist')) {
    return '路径不存在，请检查后重试';
  }
  if (lower.includes('permission denied') || lower.includes('拒绝访问')) {
    return '没有访问权限，请选择其他文件夹';
  }
  return '无法打开此文件夹，请重试';
}

function WelcomePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shortcutHint, setShortcutHint] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const logoRef = useRef<HTMLImageElement>(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const handleClose = () => {
    getCurrentWindow().close();
  };

  const handleSelectFolder = useCallback(async () => {
    // 加载中点击 → 取消
    if (loading) {
      try { await invoke('cancel_processing'); } catch { /* 忽略 */ }
      setLoading(false);
      return;
    }

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
      setError(friendlyError(err instanceof Error ? err.message : String(err)));
      setLoading(false);
    }
  }, [loading]);

  // 键盘快捷键提示：延迟显示
  useEffect(() => {
    const timer = setTimeout(() => setShortcutHint(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  // 键盘快捷键：Ctrl+O
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        handleSelectFolder();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSelectFolder]);

  // 鼠标视差（尊重 reduced-motion 偏好）
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotionRef.current || !logoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = (e.clientX - rect.left - cx) / cx;
    const dy = (e.clientY - rect.top - cy) / cy;
    logoRef.current.style.transform = `translate(${dx * -4}px, ${dy * -4}px) scale(1)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!logoRef.current) return;
    logoRef.current.style.transform = 'translate(0, 0) scale(1)';
  }, []);

  // Tauri 拖拽事件（HTML5 ondrop 在 Tauri 2 中无法获取文件路径）
  useEffect(() => {
    const webview = getCurrentWebview();
    let cancelled = false;

    webview.onDragDropEvent((event) => {
      if (cancelled) return;
      const { type } = event.payload;
      if (type === 'over') {
        setIsDragOver(true);
      } else if (type === 'drop') {
        setIsDragOver(false);
        const paths = (event.payload as { paths: string[] }).paths;
        const folderPath = paths[0];
        if (!folderPath) return;
        setLoading(true);
        setError(null);
        invoke('open_main_window', { folderPath }).catch((err) => {
          setError(friendlyError(err instanceof Error ? err.message : String(err)));
          setLoading(false);
        });
      } else {
        setIsDragOver(false);
      }
    });

    return () => { cancelled = true; };
  }, []);

  return (
    <div
      className={`${cls.window} ${isDragOver ? cls.dragOver : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Logo 居中完整显示 */}
      <img
        ref={logoRef}
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
          className={`${cls.openBtn} ${loading ? cls.openBtnLoading : ''}`}
          onClick={handleSelectFolder}
          aria-busy={loading}
          aria-label={loading ? '取消打开' : '选择图片文件夹以开始筛选'}
        >
          {loading ? (
            <>
              <svg className={cls.spinner} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28 10" strokeLinecap="round" />
              </svg>
              <span className={cls.openBtnLabel}>取消</span>
            </>
          ) : (
            <>
              <span className={cls.openBtnLabel}>选择文件夹</span>
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
            </>
          )}
        </button>
        {/* 渐进提示：快捷键 + 拖拽 */}
        <span
          className={`${cls.hintLine} ${shortcutHint ? cls.hintLineVisible : ''}`}
          aria-hidden="true"
        >
          <span className={cls.hintKey}>Ctrl+O</span>
          <span className={cls.hintSep}>·</span>
          拖入文件夹
        </span>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className={cls.errorWrap} role="alert">
          <p className={cls.errorText}>{error}</p>
          <button className={cls.errorDismiss} onClick={() => setError(null)} aria-label="关闭提示">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default WelcomePage;
