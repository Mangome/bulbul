// ============================================================
// 悬浮分组列表面板 (FloatingGroupList)
//
// 左侧悬浮面板，白色半透明毛玻璃容器。
// Header: "相似度分组" + 分组总数
// Body: 可滚动分组列表
// ============================================================

import { type CSSProperties, useMemo } from 'react';
import { GroupListItem } from './GroupListItem';
import { useAppStore } from '../../stores/useAppStore';
import { useSelectionStore } from '../../stores/useSelectionStore';
import type { GroupData } from '../../types';

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
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.title}>相似度分组</div>
        <div style={styles.subtitle}>共 {visibleGroups.length} 个分组</div>
      </div>

      {/* 列表区 */}
      <div style={styles.list}>
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
    </div>
  );
}

// ─── 样式 ─────────────────────────────────────────────

const styles: Record<string, CSSProperties> = {
  container: {
    position: 'fixed' as const,
    left: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '240px',
    maxHeight: 'calc(100vh - 180px)',
    background: 'rgba(255, 255, 255, 0.94)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: '12px',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    zIndex: 100,
    pointerEvents: 'auto' as const,
  },
  header: {
    padding: '14px 16px 10px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
  },
  title: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#1F2937',
  },
  subtitle: {
    fontSize: '11px',
    color: '#9CA3AF',
    marginTop: '2px',
  },
  list: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '6px',
  },
};
