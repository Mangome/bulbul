// ============================================================
// 鸟种统计面板 (SpeciesDashboard)
//
// 侧滑面板，复用 SettingsPanel 的布局风格。
// 展示当前目录中已识别的鸟种统计（置信度 >= 85%）。
// ============================================================

import { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { aggregateSpecies, UNIDENTIFIED_KEY } from '../../utils/speciesStats';
import type { ImageMetadata } from '../../types';
import cls from './SpeciesDashboard.module.css';

// ─── Props ────────────────────────────────────────────

export interface SpeciesDashboardProps {
  open: boolean;
  onClose: () => void;
  metadataMap: Map<string, ImageMetadata>;
}

// ─── SVG 图标 ────────────────────────────────────────

function IconClose() {
  return (
    <svg width="12" height="12" viewBox="0 0 15 15" fill="none">
      <path d="M11.5 3.5l-8 8M3.5 3.5l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconBird() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <path d="M3 8c1-3 4-5 7-5M10 3l2 1-2 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 10c2-1 4 0 6-1s3-3 4-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── 组件 ─────────────────────────────────────────────

export function SpeciesDashboard({ open, onClose, metadataMap }: SpeciesDashboardProps) {
  // P1: 只在面板打开时才计算聚合，关闭时跳过
  const stats = useMemo(() => {
    if (!open) return null;
    return aggregateSpecies(metadataMap);
  }, [open, metadataMap]);

  // P2: 面板滑入动画完成后再启用柱状条 transition，避免同时触发大量 width 动画
  const [barsReady, setBarsReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setBarsReady(false);
      return;
    }
    const timer = setTimeout(() => setBarsReady(true), 350);
    return () => clearTimeout(timer);
  }, [open]);

  const maxCount = useMemo(() => {
    if (!stats) return 1;
    if (stats.species.length === 0 && stats.unidentifiedCount === 0) return 1;
    const maxSpecies = stats.species[0]?.count ?? 0;
    return Math.max(maxSpecies, stats.unidentifiedCount);
  }, [stats]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // 面板关闭时无需渲染
  if (!stats) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={cls.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className={cls.backdrop} onClick={onClose} />

          <motion.div
            className={cls.panel}
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* 头部 */}
            <div className={cls.header}>
              <span className={cls.title}>鸟种统计</span>
              <button className={cls.closeBtn} onClick={onClose} aria-label="关闭鸟种统计">
                <IconClose />
              </button>
            </div>

            <div className={cls.content}>
              {/* 汇总 */}
              <div className={cls.group}>
                <div className={cls.summary}>
                  <div className={cls.summaryItem}>
                    <span className={cls.summaryValue}>{stats.speciesCount}</span>
                    <span className={cls.summaryLabel}>鸟种</span>
                  </div>
                  <div className={cls.summaryDivider} />
                  <div className={cls.summaryItem}>
                    <span className={cls.summaryValue}>{stats.detectedImageCount}</span>
                    <span className={cls.summaryLabel}>有检测结果</span>
                  </div>
                </div>
              </div>

              {/* 鸟种列表 */}
              <div className={cls.group}>
                <div className={cls.groupHeader}>
                  <span className={cls.groupIcon}>
                    <IconBird />
                  </span>
                  <span className={cls.groupTitle}>识别结果</span>
                </div>

                {stats.species.length === 0 && stats.unidentifiedCount === 0 ? (
                  <div className={cls.empty}>暂无鸟种识别数据</div>
                ) : (
                  <>
                    {stats.species.map((item) => (
                      <div key={item.name} className={cls.barRow}>
                        <span className={cls.barLabel} title={item.name}>{item.name}</span>
                        <div className={cls.barTrack}>
                          <div
                            className={`${cls.barFill} ${barsReady ? cls.barFillAnimated : ''}`}
                            style={{ width: `${(item.count / maxCount) * 100}%` }}
                          />
                        </div>
                        <span className={cls.barCount}>{item.count}</span>
                      </div>
                    ))}

                    {stats.unidentifiedCount > 0 && (
                      <>
                        {stats.species.length > 0 && <div className={cls.separator} />}
                        <div className={`${cls.barRow} ${cls.barRowUnidentified}`}>
                          <span className={cls.barLabel}>{UNIDENTIFIED_KEY}</span>
                          <div className={cls.barTrack}>
                            <div
                              className={`${cls.barFillUnidentified} ${barsReady ? cls.barFillAnimated : ''}`}
                              style={{ width: `${(stats.unidentifiedCount / maxCount) * 100}%` }}
                            />
                          </div>
                          <span className={cls.barCount}>{stats.unidentifiedCount}</span>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
