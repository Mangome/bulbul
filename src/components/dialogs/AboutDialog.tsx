// ============================================================
// 关于对话框 (AboutDialog)
//
// 居中模态对话框，Apple 设置页风格。
// 展示应用名 Bulbul、图标、版本号、联系方式。
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getVersion } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';
import appIcon from '../../assets/app-icon.png';
import cls from './AboutDialog.module.css';

// ─── Props ────────────────────────────────────────────

export interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

// ─── SVG 图标 ────────────────────────────────────────

function IconClose() {
  return (
    <svg width="12" height="12" viewBox="0 0 15 15" fill="none">
      <path d="M11.5 3.5l-8 8M3.5 3.5l8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconGithub() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function IconXiaohongshu() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <path d="M4 2.5v10M7.5 2.5v10M4 7.5h7M4 4.5h7M4 10.5h7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

// ─── 组件 ─────────────────────────────────────────────

export function AboutDialog({ open, onClose }: AboutDialogProps) {
  const [version, setVersion] = useState('');

  useEffect(() => {
    if (open) getVersion().then((v) => setVersion(v));
  }, [open]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const handleOpenGithub = useCallback(() => {
    openUrl('https://github.com/Mangome/bulbul');
  }, []);

  const handleOpenXiaohongshu = useCallback(() => {
    openUrl('https://www.xiaohongshu.com/user/profile/600c47c7000000000100b902');
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={cls.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className={cls.backdrop} onClick={onClose} />

          <motion.div
            className={cls.dialog}
            initial={{ opacity: 0, scale: 0.95, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 4 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
          >
            <button className={cls.closeBtn} onClick={onClose} aria-label="关闭">
              <IconClose />
            </button>

            <div className={cls.iconWrap}>
              <img src={appIcon} alt="" className={cls.icon} draggable={false} />
            </div>

            <h2 className={cls.appName}>Bulbul</h2>
            <p className={cls.version}>版本 {version}</p>

            <div className={cls.divider} />

            <div className={cls.contactList}>
              {/* GitHub — 可点击跳转 */}
              <button className={cls.contactLink} onClick={handleOpenGithub}>
                <span className={cls.contactIcon}><IconGithub /></span>
                <div>
                  <div className={cls.contactLabel}>GitHub</div>
                  <div className={cls.contactValue}>Mangome/bulbul</div>
                </div>
              </button>

              {/* 小红书 — 可点击跳转 */}
              <button className={cls.contactLink} onClick={handleOpenXiaohongshu}>
                <span className={cls.contactIcon}><IconXiaohongshu /></span>
                <div>
                  <div className={cls.contactLabel}>小红书</div>
                  <div className={cls.contactValue}>Mango</div>
                </div>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
