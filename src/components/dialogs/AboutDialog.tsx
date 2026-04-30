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

function IconMail() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <rect x="1.5" y="3.5" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
      <path d="M1.5 5l6 4 6-4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
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
              {/* 邮箱 */}
              <div className={cls.contactItem}>
                <span className={cls.contactIcon}><IconMail /></span>
                <div>
                  <div className={cls.contactLabel}>邮箱</div>
                  <div className={cls.contactValue}>imango@outlook.com</div>
                </div>
              </div>

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
