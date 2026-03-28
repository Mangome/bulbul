// ============================================================
// 顶部分组导航栏 (FloatingGroupNav)
//
// 画布顶部居中悬浮面板。
// 显示当前组名、张数、相似度，以及上一组/下一组按钮。
// ============================================================

import { motion } from 'motion/react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useSelectionStore } from '../../stores/useSelectionStore';
import type { GroupData } from '../../types';
import cls from './FloatingGroupNav.module.css';

// ─── 类型 ─────────────────────────────────────────────

export interface FloatingGroupNavProps {
  groups: GroupData[];
  onExport: () => void;
  onSelectAll: () => void;
}

// ─── 组件 ─────────────────────────────────────────────

export function FloatingGroupNav({ groups, onExport, onSelectAll }: FloatingGroupNavProps) {
  const currentGroupIndex = useCanvasStore((s) => s.currentGroupIndex);
  const groupCount = useCanvasStore((s) => s.groupCount);
  const prevGroup = useCanvasStore((s) => s.prevGroup);
  const nextGroup = useCanvasStore((s) => s.nextGroup);
  const selectedCount = useSelectionStore((s) => s.selectedCount);

  const group = groups[currentGroupIndex];
  if (!group) return null;

  const hasPrev = currentGroupIndex > 0;
  const hasNext = currentGroupIndex < groupCount - 1;

  return (
    <motion.div
      className={cls.container}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      role="navigation"
      aria-label="分组导航"
    >
      {/* 导航区：上一组 */}
      <button
        className={`${cls.navBtn} ${!hasPrev ? cls.navBtnDisabled : ''}`}
        onClick={prevGroup}
        disabled={!hasPrev}
        title="上一组 (←)"
        aria-label="上一组"
      >
        ◀
      </button>

      {/* 分组信息 */}
      <div className={cls.groupInfo}>
        <span className={cls.groupName}>{group.name}</span>
        <span className={cls.separator}>·</span>
        <span className={cls.groupMeta}>{group.imageCount} 张</span>
        <span className={cls.separator}>·</span>
        <span className={cls.groupMeta}>相似度 {group.avgSimilarity}%</span>
        <span className={cls.separator}>·</span>
        <span className={cls.groupIndex}>
          {currentGroupIndex + 1}/{groupCount}
        </span>
      </div>

      {/* 导航区：下一组 */}
      <button
        className={`${cls.navBtn} ${!hasNext ? cls.navBtnDisabled : ''}`}
        onClick={nextGroup}
        disabled={!hasNext}
        title="下一组 (→)"
        aria-label="下一组"
      >
        ▶
      </button>

      {/* 分隔线 */}
      <div className={cls.divider} />

      {/* 操作区 */}
      <div className={cls.actions}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSelectAll}
        >
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
    </motion.div>
  );
}
