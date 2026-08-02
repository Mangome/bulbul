// ============================================================
// 显示选项 Popover (ViewOptionsPopover)
//
// 顶栏「显示」按钮触发的弹出面板。
// 收纳画布视图开关（检测框/图片信息/直方图/分组高亮）与主题切换，
// 替代原「设置 → 外观」的深层路径——视图切换一步直达、即时可见。
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { DURATION, EASE } from '../../utils/motionTokens';
import cls from './ViewOptionsPopover.module.css';

// ─── 图标 ─────────────────────────────────────────────

function IconEye() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M1.5 7.5S4 3.5 7.5 3.5 13.5 7.5 13.5 7.5 11 11.5 7.5 11.5 1.5 7.5 1.5 7.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

// ─── 类型 ─────────────────────────────────────────────

export interface ViewOptionsPopoverProps {
  onOpenShortcuts: () => void;
}

// ─── 开关行 ───────────────────────────────────────────

function ToggleRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={cls.row}>
      <span className={cls.rowLabel}>{label}</span>
      <button
        className={`${cls.toggle} ${checked ? cls.toggleActive : ''}`}
        onClick={onToggle}
        role="switch"
        aria-checked={checked}
        aria-label={`${label}开关`}
      >
        <span className={cls.toggleKnob} />
      </button>
    </div>
  );
}

// ─── 组件 ─────────────────────────────────────────────

export function ViewOptionsPopover({ onOpenShortcuts }: ViewOptionsPopoverProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const showDetectionOverlay = useCanvasStore((s) => s.showDetectionOverlay);
  const toggleDetectionOverlay = useCanvasStore((s) => s.toggleDetectionOverlay);
  const showImageInfo = useCanvasStore((s) => s.showImageInfo);
  const toggleImageInfo = useCanvasStore((s) => s.toggleImageInfo);
  const showHistogram = useCanvasStore((s) => s.showHistogram);
  const toggleHistogram = useCanvasStore((s) => s.toggleHistogram);
  const groupHighlightEnabled = useCanvasStore((s) => s.groupHighlightEnabled);
  const toggleGroupHighlight = useCanvasStore((s) => s.toggleGroupHighlight);

  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [open]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <div className={cls.anchor} ref={anchorRef}>
      <button
        className={`${cls.toolBtn} ${open ? cls.toolBtnActive : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="显示选项"
        aria-label="显示选项"
        aria-expanded={open}
      >
        <IconEye />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className={cls.popover}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: DURATION.fast, ease: EASE.standard } }}
            transition={{ duration: DURATION.normal, ease: EASE.outQuint }}
          >
            <ToggleRow label="显示鸟种检测框" checked={showDetectionOverlay} onToggle={toggleDetectionOverlay} />
            <ToggleRow label="图片信息" checked={showImageInfo} onToggle={toggleImageInfo} />
            <ToggleRow label="直方图" checked={showHistogram} onToggle={toggleHistogram} />
            <ToggleRow label="分组高亮" checked={groupHighlightEnabled} onToggle={toggleGroupHighlight} />

            <div className={cls.divider} />

            <ToggleRow label="暗色主题" checked={theme === 'dark'} onToggle={toggleTheme} />

            <div className={cls.divider} />

            <button
              className={cls.shortcutRow}
              onClick={() => {
                setOpen(false);
                onOpenShortcuts();
              }}
            >
              <span>键盘快捷键</span>
              <kbd className={cls.kbd}>?</kbd>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
