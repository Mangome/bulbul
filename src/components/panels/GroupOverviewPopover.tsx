// ============================================================
// 分组总览 Popover (GroupOverviewPopover)
//
// 点击顶栏进度条弹出：全部分组的缩略图网格，点击直达跳组。
// 进度条负责「快速跳跃」，胶片条负责「精细导航」。
// ============================================================

import { motion } from 'motion/react';
import { FilmstripItem } from './FilmstripItem';
import { DURATION, EASE } from '../../utils/motionTokens';
import type { GroupData } from '../../types';
import cls from './GroupOverviewPopover.module.css';

export interface GroupOverviewPopoverProps {
  groups: GroupData[];
  currentGroupIndex: number;
  onSelect: (groupIndex: number) => void;
}

export function GroupOverviewPopover({
  groups,
  currentGroupIndex,
  onSelect,
}: GroupOverviewPopoverProps) {
  return (
    <motion.div
      className={cls.popover}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, transition: { duration: DURATION.fast, ease: EASE.standard } }}
      transition={{ duration: DURATION.normal, ease: EASE.outQuint }}
      role="menu"
      aria-label="分组总览"
    >
      <div className={cls.grid}>
        {groups.map((group, index) => (
          <FilmstripItem
            key={group.id}
            index={index}
            name={group.name}
            imageCount={group.imageCount}
            representativeHash={group.representativeHash}
            isActive={index === currentGroupIndex}
            onClick={() => onSelect(index)}
          />
        ))}
      </div>
    </motion.div>
  );
}
