// ============================================================
// 右侧控制面板 (RightControlPanel)
//
// 紧凑的垂直图标工具栏。
// 包含：缩放控件、视图快捷、主题切换。
// ============================================================

import { useCallback } from 'react';
import { motion } from 'motion/react';
import { Slider } from '../common/Slider';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useThemeStore } from '../../stores/useThemeStore';
import cls from './RightControlPanel.module.css';

// ─── 常量 ─────────────────────────────────────────────

const MIN_ZOOM_PERCENT = 10;
const MAX_ZOOM_PERCENT = 300;

// ─── SVG 图标 ────────────────────────────────────────

function IconMinus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 7h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconFit() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 5V3a1 1 0 0 1 1-1h2M9 2h2a1 1 0 0 1 1 1v2M12 9v2a1 1 0 0 1-1 1H9M5 12H3a1 1 0 0 1-1-1V9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconActual() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <text x="1" y="10" fontSize="8" fontWeight="700" fill="currentColor" fontFamily="system-ui" textAnchor="start">1:1</text>
    </svg>
  );
}

function IconSun() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7.5 1.5v1.5M7.5 12v1.5M1.5 7.5H3M12 7.5h1.5M3.3 3.3l1 1M10.7 10.7l1 1M3.3 11.7l1-1M10.7 3.3l1-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M12.5 8.5a5.5 5.5 0 0 1-7-7 5.5 5.5 0 1 0 7 7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M2 4.5V11a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H7.5L6 3.5H3A1 1 0 0 0 2 4.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

// ─── 组件 ─────────────────────────────────────────────

interface RightControlPanelProps {
  onSwitchFolder: () => void;
}

export function RightControlPanel({ onSwitchFolder }: RightControlPanelProps) {
  const zoomLevel = useCanvasStore((s) => s.zoomLevel);
  const setZoom = useCanvasStore((s) => s.setZoom);
  const zoomIn = useCanvasStore((s) => s.zoomIn);
  const zoomOut = useCanvasStore((s) => s.zoomOut);
  const fitToWindow = useCanvasStore((s) => s.fitToWindow);
  const resetZoom = useCanvasStore((s) => s.resetZoom);

  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const handleSliderChange = useCallback(
    (value: number) => {
      setZoom(value / 100);
    },
    [setZoom],
  );

  const zoomPercent = Math.round(zoomLevel * 100);

  return (
    <motion.div
      className={cls.panel}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: 0.05, ease: [0.4, 0, 0.2, 1] }}
      role="toolbar"
      aria-label="画布控制面板"
    >
      {/* 缩放 −/+ */}
      <button className={cls.iconBtn} onClick={zoomOut} title="缩小">
        <IconMinus />
      </button>

      <div className={cls.sliderWrapper}>
        <Slider
          min={MIN_ZOOM_PERCENT}
          max={MAX_ZOOM_PERCENT}
          value={zoomPercent}
          step={5}
          onChange={handleSliderChange}
          style={{ width: 130 }}
          aria-label="缩放比例"
        />
      </div>

      <button className={cls.iconBtn} onClick={zoomIn} title="放大">
        <IconPlus />
      </button>

      <span className={cls.zoomText}>{zoomPercent}%</span>

      <div className={cls.sep} />

      {/* 视图 */}
      <button className={cls.iconBtn} onClick={fitToWindow} title="适应窗口">
        <IconFit />
      </button>
      <button className={cls.iconBtn} onClick={resetZoom} title="实际大小">
        <IconActual />
      </button>

      <div className={cls.sep} />

      {/* 切换目录 */}
      <button className={cls.iconBtn} onClick={onSwitchFolder} title="切换目录 (Ctrl+O)">
        <IconFolder />
      </button>

      <div className={cls.sep} />

      {/* 主题 */}
      <button
        className={cls.iconBtn}
        onClick={toggleTheme}
        title={theme === 'light' ? '切换暗色主题' : '切换亮色主题'}
        aria-label={theme === 'light' ? '切换暗色主题' : '切换亮色主题'}
      >
        {theme === 'light' ? <IconMoon /> : <IconSun />}
      </button>
    </motion.div>
  );
}
