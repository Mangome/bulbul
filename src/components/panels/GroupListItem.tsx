// ============================================================
// 分组列表项 (GroupListItem)
//
// 展示代表图缩略图、分组名、图片数量、平均相似度、已选中数 Badge
// ============================================================

import type { CSSProperties } from 'react';
import { Badge } from '../common/Badge';

// ─── 类型 ─────────────────────────────────────────────

export interface GroupListItemProps {
  groupId: number;
  name: string;
  imageCount: number;
  avgSimilarity: number;
  selectedCount: number;
  /** 代表图 URL（由 imageService 提供） */
  thumbnailUrl: string | null;
  isActive: boolean;
  onClick: (groupId: number) => void;
}

// ─── 组件 ─────────────────────────────────────────────

export function GroupListItem({
  groupId,
  name,
  imageCount,
  avgSimilarity,
  selectedCount,
  thumbnailUrl,
  isActive,
  onClick,
}: GroupListItemProps) {
  return (
    <div
      style={{
        ...styles.container,
        ...(isActive ? styles.active : {}),
      }}
      onClick={() => onClick(groupId)}
    >
      {/* 缩略图 */}
      <div style={styles.thumbnail}>
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={name}
            style={styles.thumbnailImg}
          />
        ) : (
          <div style={styles.thumbnailPlaceholder} />
        )}
      </div>

      {/* 信息区 */}
      <div style={styles.info}>
        <div style={styles.name}>{name}</div>
        <div style={styles.meta}>
          <span>{imageCount} 张</span>
          <span style={styles.dot}>·</span>
          <span>{Math.round(avgSimilarity)}% 相似</span>
        </div>
      </div>

      {/* 选中数 Badge */}
      {selectedCount > 0 && (
        <Badge variant="primary" style={{ marginLeft: 'auto', flexShrink: 0 }}>
          {selectedCount}
        </Badge>
      )}
    </div>
  );
}

// ─── 样式 ─────────────────────────────────────────────

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.15s',
    userSelect: 'none',
  },
  active: {
    background: 'rgba(59, 130, 246, 0.1)',
  },
  thumbnail: {
    width: '50px',
    height: '50px',
    borderRadius: '6px',
    overflow: 'hidden',
    flexShrink: 0,
    background: '#E5E7EB',
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    background: '#E5E7EB',
  },
  info: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    minWidth: 0,
  },
  name: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1F2937',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  meta: {
    fontSize: '11px',
    color: '#6B7280',
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  },
  dot: {
    margin: '0 2px',
  },
};
