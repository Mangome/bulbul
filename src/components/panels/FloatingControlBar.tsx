// ============================================================
// 悬浮控制栏 (FloatingControlBar)
//
// 底部居中毛玻璃面板
// 包含：缩放控件 | 视图控制 | 进度圆点 | 主题切换
// ============================================================

import { useCallback } from 'react';
import { motion } from 'motion/react';
import { Button } from '../common/Button';
import { Slider } from '../common/Slider';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useThemeStore } from '../../stores/useThemeStore';
import cls from './FloatingControlBar.module.css';

// ─── 常量 ─────────────────────────────────────────────

const MIN_ZOOM_PERCENT = 10;
const MAX_ZOOM_PERCENT = 300;

// ─── 组件 ─────────────────────────────────────────────

export function FloatingControlBar() {
  const zoomLevel = useCanvasStore((s) => s.zoomLevel);
  const setZoom = useCanvasStore((s) => s.setZoom);
  const zoomIn = useCanvasStore((s) => s.zoomIn);
  const zoomOut = useCanvasStore((s) => s.zoomOut);
  const fitToWindow = useCanvasStore((s) => s.fitToWindow);
  const resetZoom = useCanvasStore((s) => s.resetZoom);
  const currentGroupIndex = useCanvasStore((s) => s.currentGroupIndex);
  const groupCount = useCanvasStore((s) => s.groupCount);
  const goToGroup = useCanvasStore((s) => s.goToGroup);

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
      className={cls.container}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05, ease: [0.4, 0, 0.2, 1] }}
      role="toolbar"
      aria-label="画布控制栏"
    >
      {/* 缩放控件区 */}
      <div className={cls.section}>
        <Button variant="ghost" size="sm" onClick={zoomOut}>
          −
        </Button>
        <div className={cls.sliderWrapper}>
          <Slider
            min={MIN_ZOOM_PERCENT}
            max={MAX_ZOOM_PERCENT}
            value={zoomPercent}
            step={5}
            onChange={handleSliderChange}
            aria-label="缩放比例"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={zoomIn}>
          +
        </Button>
        <span className={cls.zoomText}>{zoomPercent}%</span>
      </div>

      {/* 分隔线 */}
      <div className={cls.divider} />

      {/* 视图控制区 */}
      <div className={cls.section}>
        <Button variant="ghost" size="sm" onClick={fitToWindow}>
          适应窗口
        </Button>
        <Button variant="ghost" size="sm" onClick={resetZoom}>
          实际大小
        </Button>
      </div>

      {/* 分隔线 */}
      <div className={cls.divider} />

      {/* 分组进度圆点 */}
      {groupCount > 0 && (
        <>
          <div className={cls.progressDots}>
            {Array.from({ length: groupCount }, (_, i) => (
              <button
                key={i}
                className={`${cls.dot} ${i === currentGroupIndex ? cls.dotActive : ''}`}
                onClick={() => goToGroup(i)}
                title={`第 ${i + 1} 组`}
                aria-label={`切换到第 ${i + 1} 组`}
                aria-current={i === currentGroupIndex ? 'true' : undefined}
              />
            ))}
          </div>
          <div className={cls.divider} />
        </>
      )}

      {/* 主题切换 */}
      <button
        className={cls.themeBtn}
        onClick={toggleTheme}
        title={theme === 'light' ? '切换暗色主题' : '切换亮色主题'}
        aria-label={theme === 'light' ? '切换暗色主题' : '切换亮色主题'}
      >
        {theme === 'light' ? '\u263E' : '\u2600'}
      </button>
    </motion.div>
  );
}
