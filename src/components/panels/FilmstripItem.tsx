// ============================================================
// 胶片条单项 (FilmstripItem)
//
// 单个分组的缩略图 + 图片数量，用于 BottomFilmstrip。
// 异步加载代表图缩略图。
// ============================================================

import { memo, useState, useEffect } from 'react';
import * as imageService from '../../services/imageService';
import cls from './FilmstripItem.module.css';

// ─── 类型 ─────────────────────────────────────────────

export interface FilmstripItemProps {
  index: number;
  name: string;
  imageCount: number;
  representativeHash: string;
  isActive: boolean;
  onClick: () => void;
}

// ─── 组件 ─────────────────────────────────────────────

export const FilmstripItem = memo(function FilmstripItem({
  index,
  name,
  imageCount,
  representativeHash,
  isActive,
  onClick,
}: FilmstripItemProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    imageService
      .getImageUrl(representativeHash, 'thumbnail')
      .then((assetUrl) => {
        if (cancelled) return;
        // 通过 fetch + blob 加载，避免生产构建中 <img> 直接引用 asset:// 协议失败
        return fetch(assetUrl).then((r) => r.blob());
      })
      .then((blob) => {
        if (cancelled || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setThumbUrl(objectUrl);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [representativeHash]);

  return (
    <button
      className={`${cls.item} ${isActive ? cls.active : ''}`}
      onClick={onClick}
      data-filmstrip-index={index}
      title={`${name} (${imageCount} 张)`}
      aria-label={`${name}，${imageCount} 张图片`}
      aria-pressed={isActive}
    >
      <div className={cls.thumb}>
        {thumbUrl ? (
          <img src={thumbUrl} alt={name} className={cls.thumbImg} />
        ) : (
          <div className={cls.thumbPlaceholder} />
        )}
      </div>
      <span className={cls.count}>{imageCount}</span>
    </button>
  );
});
