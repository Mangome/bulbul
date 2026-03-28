// ============================================================
// 分组列表项 (GroupListItem)
//
// 展示代表图缩略图、分组名、图片数量、平均相似度、已选中数 Badge
// ============================================================

import { Badge } from '../common/Badge';
import cls from './GroupListItem.module.css';

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
      className={`${cls.container} ${isActive ? cls.active : ''}`}
      onClick={() => onClick(groupId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(groupId);
        }
      }}
      data-group-id={groupId}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      aria-label={`${name}，${imageCount} 张图片，${Math.round(avgSimilarity)}% 相似度${selectedCount > 0 ? `，已选 ${selectedCount} 张` : ''}`}
    >
      {/* 缩略图 */}
      <div className={cls.thumbnail}>
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={name}
            className={cls.thumbnailImg}
          />
        ) : (
          <div className={cls.thumbnailPlaceholder} />
        )}
      </div>

      {/* 信息区 */}
      <div className={cls.info}>
        <div className={cls.name}>{name}</div>
        <div className={cls.meta}>
          <span>{imageCount} 张</span>
          <span className={cls.dot}>·</span>
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
