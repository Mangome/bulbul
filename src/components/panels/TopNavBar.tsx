// ============================================================
// 顶部导航栏 (TopNavBar)
//
// 全宽顶部细条，替代原 FloatingGroupNav。
// 包含：分组导航箭头 | 分组名 | 进度条 | 全选/导出按钮
// ============================================================

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useSelectionStore } from '../../stores/useSelectionStore';
import type { GroupData } from '../../types';
import cls from './TopNavBar.module.css';

// ─── 类型 ─────────────────────────────────────────────

export interface TopNavBarProps {
  groups: GroupData[];
  /** 当前文件夹完整路径 */
  folderPath: string | null;
  onExport: () => void;
  onSelectAll: () => void;
}

// ─── 组件 ─────────────────────────────────────────────

/** 将完整路径截断为末尾 N 段，前面用 … 省略 */
function shortenPath(fullPath: string, maxSegments = 3): string {
  const normalized = fullPath.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length <= maxSegments) return normalized;
  return '\u2026/' + segments.slice(-maxSegments).join('/');
}

export function TopNavBar({ groups, folderPath, onExport, onSelectAll }: TopNavBarProps) {
  const currentGroupIndex = useCanvasStore((s) => s.currentGroupIndex);
  const groupCount = useCanvasStore((s) => s.groupCount);
  const prevGroup = useCanvasStore((s) => s.prevGroup);
  const nextGroup = useCanvasStore((s) => s.nextGroup);
  const selectedCount = useSelectionStore((s) => s.selectedCount);

  const [copied, setCopied] = useState(false);

  const displayPath = useMemo(
    () => (folderPath ? shortenPath(folderPath) : null),
    [folderPath],
  );

  const handleCopyPath = useCallback(async () => {
    if (!folderPath) return;
    await navigator.clipboard.writeText(folderPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [folderPath]);

  const group = groups[currentGroupIndex];
  if (!group) return null;

  const hasPrev = currentGroupIndex > 0;
  const hasNext = currentGroupIndex < groupCount - 1;
  const progressPercent = groupCount > 0
    ? ((currentGroupIndex + 1) / groupCount) * 100
    : 0;

  return (
    <motion.div
      className={cls.container}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      role="navigation"
      aria-label="分组导航"
    >
      {/* 左区：分组导航 */}
      <div className={cls.navSection}>
        <button
          className={`${cls.navBtn} ${!hasPrev ? cls.navBtnDisabled : ''}`}
          onClick={prevGroup}
          disabled={!hasPrev}
          title="上一组 (←)"
          aria-label="上一组"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>

        <span className={cls.groupName}>{group.name}</span>

        <button
          className={`${cls.navBtn} ${!hasNext ? cls.navBtnDisabled : ''}`}
          onClick={nextGroup}
          disabled={!hasNext}
          title="下一组 (→)"
          aria-label="下一组"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      {/* 路径显示 */}
      {displayPath && (
        <>
          <span className={cls.pathDivider} />
          <button
            className={`${cls.folderPath} ${copied ? cls.folderPathCopied : ''}`}
            onClick={handleCopyPath}
            title={copied ? '已复制' : folderPath!}
            aria-label={`当前目录: ${folderPath}`}
          >
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.span
                  key="copied"
                  className={cls.copiedContent}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  <span>已复制</span>
                </motion.span>
              ) : (
                <motion.span
                  key="path"
                  className={cls.pathContent}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <svg className={cls.pathIcon} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                  <span className={cls.pathText}>{displayPath}</span>
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </>
      )}

      {/* 中区：进度条 */}
      <div className={cls.progressSection}>
        <div className={cls.progressTrack}>
          <div
            className={cls.progressFill}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className={cls.progressText}>
          {currentGroupIndex + 1}/{groupCount}
        </span>
      </div>

      {/* 右区：操作按钮 */}
      <div className={cls.actionsSection}>
        <Button variant="ghost" size="sm" onClick={onSelectAll}>
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
                background: 'rgba(255,255,255,0.25)',
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
