// ============================================================
// 悬浮分组列表面板 (FloatingGroupList)
//
// 左侧悬浮面板，白色半透明毛玻璃容器。
// Header: "相似度分组" + 分组总数
// Body: 可滚动分组列表
// ============================================================

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { GroupListItem } from './GroupListItem';
import { useAppStore } from '../../stores/useAppStore';
import { useSelectionStore } from '../../stores/useSelectionStore';
import type { GroupData } from '../../types';
import cls from './FloatingGroupList.module.css';

// ─── 类型 ─────────────────────────────────────────────

export interface FloatingGroupListProps {
  groups: GroupData[];
  /** hash → 缩略图 URL */
  thumbnailUrls: Map<string, string>;
  onGroupClick: (groupId: number) => void;
}

// ─── 组件 ─────────────────────────────────────────────

export function FloatingGroupList({
  groups,
  thumbnailUrls,
  onGroupClick,
}: FloatingGroupListProps) {
  const selectedGroupId = useAppStore((s) => s.selectedGroupId);
  const selectedHashes = useSelectionStore((s) => s.selectedHashes);

  // 过滤空分组
  const visibleGroups = useMemo(
    () => groups.filter((g) => g.imageCount > 0),
    [groups],
  );

  return (
    <motion.div
      className={cls.container}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Header */}
      <div className={cls.header}>
        <div className={cls.title}>相似度分组</div>
        <div className={cls.subtitle}>共 {visibleGroups.length} 个分组</div>
      </div>

      {/* 列表区 */}
      <div className={cls.list}>
        {visibleGroups.map((group) => {
          const selCount = group.pictureHashes.filter((h) =>
            selectedHashes.has(h),
          ).length;

          return (
            <GroupListItem
              key={group.id}
              groupId={group.id}
              name={group.name}
              imageCount={group.imageCount}
              avgSimilarity={group.avgSimilarity}
              selectedCount={selCount}
              thumbnailUrl={
                thumbnailUrls.get(group.representativeHash) ?? null
              }
              isActive={selectedGroupId === group.id}
              onClick={onGroupClick}
            />
          );
        })}
      </div>
    </motion.div>
  );
}
