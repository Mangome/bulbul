// ============================================================
// 悬浮分组列表面板 (FloatingGroupList)
//
// 左侧浮动毛玻璃面板。
// Header: 文件夹信息 + 收叠按钮
// Body: 可滚动分组列表
// 支持收叠为小图标按钮
// ============================================================

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  /** 文件夹显示名 */
  folderName: string | null;
  /** 图片总数 */
  imageTotal: number;
}

// ─── 组件 ─────────────────────────────────────────────

export function FloatingGroupList({
  groups,
  thumbnailUrls,
  onGroupClick,
  folderName,
  imageTotal,
}: FloatingGroupListProps) {
  const selectedGroupId = useAppStore((s) => s.selectedGroupId);
  const selectedHashes = useSelectionStore((s) => s.selectedHashes);
  const [collapsed, setCollapsed] = useState(false);

  // 过滤空分组
  const visibleGroups = useMemo(
    () => groups.filter((g) => g.imageCount > 0),
    [groups],
  );

  return (
    <motion.div
      className={`${cls.container} ${collapsed ? cls.collapsed : ''}`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      layout
    >
      {/* 收叠态：仅显示展开按钮 */}
      {collapsed && (
        <button
          className={cls.toggleBtn}
          onClick={() => setCollapsed(false)}
          title="展开面板"
        >
          ▶
        </button>
      )}

      {/* 展开态内容 */}
      <AnimatePresence>
        {!collapsed && (
          <>
            {/* Header - 文件夹信息 */}
            <div className={cls.header}>
              <div className={cls.headerTop}>
                <span className={cls.folderName}>
                  {folderName ?? '未选择文件夹'}
                </span>
                <button
                  className={cls.toggleBtn}
                  onClick={() => setCollapsed(true)}
                  title="收叠面板"
                >
                  ◀
                </button>
              </div>
              {imageTotal > 0 && (
                <div className={cls.folderMeta}>
                  {imageTotal} 张图片 · {visibleGroups.length} 个分组
                </div>
              )}
              <div className={cls.sectionLabel}>分组</div>
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
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
