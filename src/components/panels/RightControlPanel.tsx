// ============================================================
// 右侧控制面板 (RightControlPanel)
//
// 紧凑的垂直图标工具栏。
// 包含：检测框切换、分组参数、切换目录、主题切换。
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Slider } from '../common/Slider';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { useGroupingStore } from '../../stores/useGroupingStore';
import { useAppStore } from '../../stores/useAppStore';
import { useProcessing } from '../../hooks/useProcessing';
import cls from './RightControlPanel.module.css';

// ─── SVG 图标 ────────────────────────────────────────

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

function IconDetection() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7.5 1v2M7.5 12v2M1 7.5h2M12 7.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconTune() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M2 4h3M8 4h5M5 2.5v3M2 7.5h5M10 7.5h3M7 6v3M2 11h7M12 11h1M9 9.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// ─── 组件 ─────────────────────────────────────────────

interface RightControlPanelProps {
  onSwitchFolder: () => void;
}

export function RightControlPanel({ onSwitchFolder }: RightControlPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const showDetectionOverlay = useCanvasStore((s) => s.showDetectionOverlay);
  const toggleDetectionOverlay = useCanvasStore((s) => s.toggleDetectionOverlay);

  const similarityThreshold = useGroupingStore((s) => s.similarityThreshold);
  const timeGapSeconds = useGroupingStore((s) => s.timeGapSeconds);
  const setSimilarityThreshold = useGroupingStore((s) => s.setSimilarityThreshold);
  const setTimeGapSeconds = useGroupingStore((s) => s.setTimeGapSeconds);

  const hasGroups = useAppStore((s) => s.groups.length > 0);
  const { regroupWith } = useProcessing();

  const [showGroupingPopover, setShowGroupingPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const regroupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 点击外部关闭弹窗
  useEffect(() => {
    if (!showGroupingPopover) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowGroupingPopover(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [showGroupingPopover]);

  // 防抖触发 regroup
  const scheduleRegroup = useCallback(
    (similarity: number, timeGap: number) => {
      if (!hasGroups) return;
      if (regroupTimerRef.current) clearTimeout(regroupTimerRef.current);
      regroupTimerRef.current = setTimeout(() => {
        regroupTimerRef.current = null;
        regroupWith(similarity, timeGap);
      }, 500);
    },
    [hasGroups, regroupWith],
  );

  const handleSimilarityChange = useCallback(
    (value: number) => {
      setSimilarityThreshold(value);
      scheduleRegroup(value, useGroupingStore.getState().timeGapSeconds);
    },
    [setSimilarityThreshold, scheduleRegroup],
  );

  const handleTimeGapChange = useCallback(
    (value: number) => {
      setTimeGapSeconds(value);
      scheduleRegroup(useGroupingStore.getState().similarityThreshold, value);
    },
    [setTimeGapSeconds, scheduleRegroup],
  );

  return (
    <motion.div
      className={cls.panel}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: 0.05, ease: [0.4, 0, 0.2, 1] }}
      role="toolbar"
      aria-label="画布控制面板"
    >
      {/* 检测框切换 */}
      <button
        className={`${cls.iconBtn} ${showDetectionOverlay ? cls.iconBtnActive : ''}`}
        onClick={toggleDetectionOverlay}
        title={showDetectionOverlay ? '隐藏检测框' : '显示检测框'}
        aria-label={showDetectionOverlay ? '隐藏检测框' : '显示检测框'}
      >
        <IconDetection />
      </button>

      {/* 分组参数 */}
      <div className={cls.popoverAnchor} ref={popoverRef}>
        <button
          className={`${cls.iconBtn} ${showGroupingPopover ? cls.iconBtnActive : ''}`}
          onClick={() => setShowGroupingPopover((v) => !v)}
          title="分组参数"
          aria-label="分组参数"
        >
          <IconTune />
        </button>
        <AnimatePresence>
          {showGroupingPopover && (
            <motion.div
              className={cls.popover}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
            >
              <div className={cls.popoverSection}>
                <div className={cls.popoverLabel}>
                  <span>相似度</span>
                  <span className={cls.popoverValue}>{Math.round(similarityThreshold)}%</span>
                </div>
                <Slider
                  min={50}
                  max={100}
                  value={Math.round(similarityThreshold)}
                  step={1}
                  onChange={handleSimilarityChange}
                  aria-label="相似度阈值"
                />
              </div>
              <div className={cls.popoverSection}>
                <div className={cls.popoverLabel}>
                  <span>时间间隔</span>
                  <span className={cls.popoverValue}>{timeGapSeconds}s</span>
                </div>
                <Slider
                  min={1}
                  max={120}
                  value={timeGapSeconds}
                  step={1}
                  onChange={handleTimeGapChange}
                  aria-label="时间间隔阈值"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
