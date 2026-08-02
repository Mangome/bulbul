// ============================================================
// 底部胶片条 (BottomFilmstrip)
//
// 固定在视口底部，水平缩略图条，用于分组快速导航。
// 每个分组显示代表图缩略图 + 图片数量。
// 支持键盘导航自动滚动。
// ============================================================

import { useRef, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { DURATION, EASE } from '../../utils/motionTokens';
import { FilmstripItem } from './FilmstripItem';
import { useCanvasStore } from '../../stores/useCanvasStore';
import type { GroupData } from '../../types';
import cls from './BottomFilmstrip.module.css';

// ─── 类型 ─────────────────────────────────────────────

export interface BottomFilmstripProps {
  groups: GroupData[];
  onGroupClick: (groupIndex: number) => void;
}

// ─── 组件 ─────────────────────────────────────────────

export function BottomFilmstrip({ groups, onGroupClick }: BottomFilmstripProps) {
  const currentGroupIndex = useCanvasStore((s) => s.currentGroupIndex);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollTimeRef = useRef<number>(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // 检测滚动位置，更新渐变提示可见性
  const updateScrollHints = useRef(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollHints.current();
    el.addEventListener('scroll', updateScrollHints.current, { passive: true });
    const ro = new ResizeObserver(updateScrollHints.current);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollHints.current);
      ro.disconnect();
    };
  }, [groups]);

  // 当前分组变化时，自动滚动胶片条使活动项可见。
  // 连续快速切换时改用 instant，避免 smooth 动画排队造成卡顿。
  useEffect(() => {
    if (!scrollRef.current) return;
    const activeEl = scrollRef.current.querySelector(
      `[data-filmstrip-index="${currentGroupIndex}"]`,
    ) as HTMLElement | null;
    if (!activeEl) return;

    const now = performance.now();
    const gap = now - lastScrollTimeRef.current;
    lastScrollTimeRef.current = now;

    // 300ms 内连续切换视为快速连击，跳过动画
    const behavior: ScrollBehavior = gap < 300 ? 'instant' : 'smooth';
    activeEl.scrollIntoView({ behavior, block: 'nearest', inline: 'center' });
  }, [currentGroupIndex]);

  if (groups.length === 0) return null;

  return (
    <motion.div
      className={`${cls.container} ${canScrollLeft ? cls.scrollLeft : ''} ${canScrollRight ? cls.scrollRight : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.normal, ease: EASE.outQuint }}
      role="navigation"
      aria-label="分组胶片条"
    >
      <div className={cls.scrollArea} ref={scrollRef}>
        {groups.map((group, index) => (
          <FilmstripItem
            key={group.id}
            index={index}
            name={group.name}
            imageCount={group.imageCount}
            representativeHash={group.representativeHash}
            isActive={index === currentGroupIndex}
            onClick={() => onGroupClick(index)}
          />
        ))}
      </div>
    </motion.div>
  );
}
