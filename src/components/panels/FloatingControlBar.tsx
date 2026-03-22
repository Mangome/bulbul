// ============================================================
// 悬浮控制栏 (FloatingControlBar)
//
// 底部居中 pill 形状毛玻璃容器。
// 包含：缩放控件 | 视图控制 | 导出入口
// ============================================================

import { type CSSProperties, useCallback } from 'react';
import { Button } from '../common/Button';
import { Slider } from '../common/Slider';
import { Badge } from '../common/Badge';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useSelectionStore } from '../../stores/useSelectionStore';

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

  const handleSliderChange = useCallback(
    (value: number) => {
      setZoom(value / 100);
    },
    [setZoom],
  );

  const zoomPercent = Math.round(zoomLevel * 100);

  return (
    <div style={styles.container}>
      {/* 缩放控件区 */}
      <div style={styles.section}>
        <Button variant="ghost" size="sm" onClick={zoomOut}>
          −
        </Button>
        <div style={styles.sliderWrapper}>
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
        <span style={styles.zoomText}>{zoomPercent}%</span>
      </div>

      {/* 分隔线 */}
      <div style={styles.divider} />

      {/* 视图控制区 */}
      <div style={styles.section}>
        <Button variant="ghost" size="sm" onClick={fitToWindow}>
          适应窗口
        </Button>
        <Button variant="ghost" size="sm" onClick={resetZoom}>
          实际大小
        </Button>
      </div>

      {/* 分隔线 */}
      <div style={styles.divider} />

      {/* 导出区 */}
      <div style={styles.section}>
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
    </div>
  );
}

// ─── 样式 ─────────────────────────────────────────────

const styles: Record<string, CSSProperties> = {
  container: {
    position: 'fixed' as const,
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    background: 'rgba(255, 255, 255, 0.94)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: '999px',
    boxShadow:
      '0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)',
    zIndex: 100,
    pointerEvents: 'auto' as const,
  },
  section: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  sliderWrapper: {
    width: '100px',
  },
  zoomText: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#6B7280',
    minWidth: '36px',
    textAlign: 'center' as const,
  },
  divider: {
    width: '1px',
    height: '20px',
    background: 'rgba(0, 0, 0, 0.1)',
    margin: '0 4px',
  },
};
