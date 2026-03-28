// ============================================================
// 悬浮控制栏 (FloatingControlBar)
//
// 底部居中 pill 形状毛玻璃容器。
// 包含：缩放控件 | 视图控制 | 导出入口 | 主题切换
// ============================================================

import { useCallback } from 'react';
import { motion } from 'motion/react';
import { Button } from '../common/Button';
import { Slider } from '../common/Slider';
import { Badge } from '../common/Badge';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useSelectionStore } from '../../stores/useSelectionStore';
import { useThemeStore } from '../../stores/useThemeStore';
import cls from './FloatingControlBar.module.css';

// ─── 类型 ─────────────────────────────────────────────

export interface FloatingControlBarProps {
  onExport: () => void;
}

// ─── 常量 ─────────────────────────────────────────────

const MIN_ZOOM_PERCENT = 10;
const MAX_ZOOM_PERCENT = 300;

// ─── 组件 ─────────────────────────────────────────────

export function FloatingControlBar({ onExport }: FloatingControlBarProps) {
  const zoomLevel = useCanvasStore((s) => s.zoomLevel);
  const setZoom = useCanvasStore((s) => s.setZoom);
  const zoomIn = useCanvasStore((s) => s.zoomIn);
  const zoomOut = useCanvasStore((s) => s.zoomOut);
  const fitToWindow = useCanvasStore((s) => s.fitToWindow);
  const resetZoom = useCanvasStore((s) => s.resetZoom);

  const selectedCount = useSelectionStore((s) => s.selectedCount);

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
      transition={{ duration: 0.3, ease: 'easeOut' }}
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

      {/* 导出区 */}
      <div className={cls.section}>
        <Button
          variant="primary"
          size="sm"
          disabled={selectedCount === 0}
          onClick={onExport}
        >
          导出
          {selectedCount > 0 && (
            <Badge
              variant="primary"
              style={{
                background: 'rgba(255,255,255,0.3)',
                color: '#FFFFFF',
                marginLeft: '4px',
              }}
            >
              {selectedCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* 分隔线 */}
      <div className={cls.divider} />

      {/* 主题切换 */}
      <button
        className={cls.themeBtn}
        onClick={toggleTheme}
        title={theme === 'light' ? '切换暗色主题' : '切换亮色主题'}
      >
        {theme === 'light' ? '\u263E' : '\u2600'}
      </button>
    </motion.div>
  );
}
