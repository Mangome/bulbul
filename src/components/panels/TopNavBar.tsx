// ============================================================
// 顶部导航栏 (TopNavBar)
//
// 全宽顶部细条，替代原 FloatingGroupNav。
// 包含：分组导航箭头 | 分组名 | 进度条 | 全选/导出按钮
// ============================================================

import { motion } from 'motion/react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useSelectionStore } from '../../stores/useSelectionStore';
import type { GroupData } from '../../types';
import cls from './TopNavBar.module.css';

// ─── 类型 ─────────────────────────────────────────────

export interface TopNavBarProps {
  groups: GroupData[];
  onExport: () => void;
  onSelectAll: () => void;
}

// ─── 组件 ─────────────────────────────────────────────

export function TopNavBar({ groups, onExport, onSelectAll }: TopNavBarProps) {
  const currentGroupIndex = useCanvasStore((s) => s.currentGroupIndex);
  const groupCount = useCanvasStore((s) => s.groupCount);
  const prevGroup = useCanvasStore((s) => s.prevGroup);
  const nextGroup = useCanvasStore((s) => s.nextGroup);
  const selectedCount = useSelectionStore((s) => s.selectedCount);

  const group = groups[currentGroupIndex];
  if (!group) return null;

  const hasPrev = currentGroupIndex > 0;
  const hasNext = currentGroupIndex < groupCount - 1;
  const progressPercent = groupCount > 0
    ? ((currentGroupIndex + 1) / groupCount) * 100
    : 0;

  return (
    <motion.div
      className={cls.container}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      role="navigation"
      aria-label="分组导航"
    >
      {/* 左区：分组导航 */}
      <div className={cls.navSection}>
        <button
          className={`${cls.navBtn} ${!hasPrev ? cls.navBtnDisabled : ''}`}
          onClick={prevGroup}
          disabled={!hasPrev}
          title="上一组 (←)"
          aria-label="上一组"
        >
          ‹
        </button>

        <span className={cls.groupName}>{group.name}</span>

        <button
          className={`${cls.navBtn} ${!hasNext ? cls.navBtnDisabled : ''}`}
          onClick={nextGroup}
          disabled={!hasNext}
          title="下一组 (→)"
          aria-label="下一组"
        >
          ›
        </button>
      </div>

      {/* 中区：进度条 */}
      <div className={cls.progressSection}>
        <div className={cls.progressTrack}>
          <div
            className={cls.progressFill}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className={cls.progressText}>
          {currentGroupIndex + 1}/{groupCount}
        </span>
      </div>

      {/* 右区：操作按钮 */}
      <div className={cls.actionsSection}>
        <Button variant="ghost" size="sm" onClick={onSelectAll}>
          全选
        </Button>
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
                background: 'rgba(255,255,255,0.25)',
                color: '#FFFFFF',
                marginLeft: '4px',
              }}
            >
              {selectedCount}
            </Badge>
          )}
        </Button>
      </div>
    </motion.div>
  );
}
