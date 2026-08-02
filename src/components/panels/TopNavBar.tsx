// ============================================================
// 顶部导航栏 (TopNavBar)
//
// 全宽顶部条，44px 高度。
// 左区：路径
// 中区：进度条
// 右区：工具按钮（省份、设置、切换目录、主题）+ 导出
// ============================================================

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DURATION, EASE } from '../../utils/motionTokens';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { ViewOptionsPopover } from './ViewOptionsPopover';
import { GroupOverviewPopover } from './GroupOverviewPopover';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useSelectionStore } from '../../stores/useSelectionStore';
import { useAppStore } from '../../stores/useAppStore';
import { useGeoStore } from '../../stores/useGeoStore';
import { reclassify } from '../../services/processService';
import { getProvincesGrouped } from '../../data/provinces';
import type { Province, RegionGroup } from '../../data/provinces';
import type { GroupData } from '../../types';
import cls from './TopNavBar.module.css';

// ─── SVG 图标 ────────────────────────────────────────

function IconFolder() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M2 4.5V11a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H7.5L6 3.5H3A1 1 0 0 0 2 4.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M5.5 1.5v11.5M9.5 2v11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M1.5 4.5l4-1 4 1.5 4-1v7l-4 1-4-1.5-4 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function IconBirdStats() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M3 8c1-3 4-5 7-5M10 3l2 1-2 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 10c2-1 4 0 6-1s3-3 4-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="11.5" cy="11.5" r="3" stroke="currentColor" strokeWidth="1.2" />
      <path d="M11.5 10v3M10 11.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 9.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M12.9 9.3l-.6-.4a.5.5 0 0 1-.2-.6l.2-.7a.5.5 0 0 1 .6-.3l.7.1a.5.5 0 0 0 .5-.3 5.2 5.2 0 0 0 .1-1.2.5.5 0 0 0-.4-.4l-.7-.1a.5.5 0 0 1-.4-.4l-.2-.7a.5.5 0 0 1 .2-.6l.6-.4a.5.5 0 0 0 .1-.6 5.4 5.4 0 0 0-.8-1 .5.5 0 0 0-.6 0l-.5.5a.5.5 0 0 1-.6 0l-.6-.3a.5.5 0 0 1-.3-.5l.1-.7a.5.5 0 0 0-.3-.5 5.2 5.2 0 0 0-1.2-.1.5.5 0 0 0-.4.4l-.1.7a.5.5 0 0 1-.4.4l-.7.2a.5.5 0 0 1-.6-.2l-.4-.6a.5.5 0 0 0-.6-.1 5.4 5.4 0 0 0-1 .8.5.5 0 0 0 0 .6l.5.5a.5.5 0 0 1 0 .6l-.3.6a.5.5 0 0 1-.5.3l-.7-.1a.5.5 0 0 0-.5.3 5.2 5.2 0 0 0-.1 1.2.5.5 0 0 0 .4.4l.7.1a.5.5 0 0 1 .4.4l.2.7a.5.5 0 0 1-.2.6l-.6.4a.5.5 0 0 0-.1.6 5.4 5.4 0 0 0 .8 1 .5.5 0 0 0 .6 0l.5-.5a.5.5 0 0 1 .6 0l.6.3a.5.5 0 0 1 .3.5l-.1.7a.5.5 0 0 0 .3.5 5.2 5.2 0 0 0 1.2.1.5.5 0 0 0 .4-.4l.1-.7a.5.5 0 0 1 .4-.4l.7-.2a.5.5 0 0 1 .6.2l.4.6a.5.5 0 0 0 .6.1 5.4 5.4 0 0 0 1-.8.5.5 0 0 0 0-.6l-.5-.5Z" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

// ─── 类型 ─────────────────────────────────────────────

export interface TopNavBarProps {
  groups: GroupData[];
  /** 当前文件夹完整路径 */
  folderPath: string | null;
  onExport: () => void;
  onSwitchFolder: () => void;
  onOpenSettings: () => void;
  onOpenSpeciesDashboard: () => void;
  /** 点击进度条总览 / 跳组 */
  onNavigateGroup: (groupIndex: number) => void;
  /** 打开快捷键速查表 */
  onOpenShortcuts: () => void;
}

// ─── 工具函数 ─────────────────────────────────────────

/** 将完整路径截断为末尾 N 段，前面用 … 省略 */
function shortenPath(fullPath: string, maxSegments = 3): string {
  const normalized = fullPath.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length <= maxSegments) return normalized;
  return '\u2026/' + segments.slice(-maxSegments).join('/');
}

// ─── 组件 ─────────────────────────────────────────────

export function TopNavBar({
  groups,
  folderPath,
  onExport,
  onSwitchFolder,
  onOpenSettings,
  onOpenSpeciesDashboard,
  onNavigateGroup,
  onOpenShortcuts,
}: TopNavBarProps) {
  const currentGroupIndex = useCanvasStore((s) => s.currentGroupIndex);
  const groupCount = useCanvasStore((s) => s.groupCount);
  const selectedCount = useSelectionStore((s) => s.selectedCount);
  const clearSelection = useSelectionStore((s) => s.clearSelection);

  // 省份选择
  const selectedProvince = useGeoStore((s) => s.selectedProvince);
  const setProvince = useGeoStore((s) => s.setProvince);
  const hasGroups = useAppStore((s) => s.groups.length > 0);
  const [provinceSearch, setProvinceSearch] = useState('');

  const filteredGroups = useMemo((): RegionGroup[] => {
    if (!provinceSearch) return getProvincesGrouped();
    const keyword = provinceSearch;
    return getProvincesGrouped()
      .map((g) => ({
        ...g,
        provinces: g.provinces.filter((p) => p.name.includes(keyword)),
      }))
      .filter((g) => g.provinces.length > 0);
  }, [provinceSearch]);

  const handleSelectProvince = useCallback(async (province: Province | null) => {
    setProvince(province);
    setShowProvincePopover(false);
    setProvinceSearch('');
    setReclassifyLoading(true);
    try {
      if (province) {
        await reclassify(province.minLat, province.maxLat, province.minLng, province.maxLng);
      } else {
        await reclassify(0.0, 0.0, 0.0, 0.0);
      }
    } catch (e) {
      console.error('重分类失败:', e);
    } finally {
      setReclassifyLoading(false);
    }
  }, [setProvince]);

  const [copied, setCopied] = useState(false);
  const [showProvincePopover, setShowProvincePopover] = useState(false);
  const [showGroupOverview, setShowGroupOverview] = useState(false);
  const [reclassifyLoading, setReclassifyLoading] = useState(false);
  const provincePopoverRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

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

  // 点击外部关闭省份弹窗 / 分组总览
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showProvincePopover && provincePopoverRef.current && !provincePopoverRef.current.contains(e.target as Node)) {
        setShowProvincePopover(false);
      }
      if (showGroupOverview && progressRef.current && !progressRef.current.contains(e.target as Node)) {
        setShowGroupOverview(false);
      }
    };
    if (showProvincePopover || showGroupOverview) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [showProvincePopover, showGroupOverview]);

  const group = groups[currentGroupIndex];
  if (!group) return null;

  const progressPercent = groupCount > 0
    ? ((currentGroupIndex + 1) / groupCount) * 100
    : 0;

  return (
    <motion.div
      className={cls.container}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.normal, ease: EASE.outQuint }}
      role="navigation"
      aria-label="分组导航"
    >
      {/* 左区：路径显示 */}
      {displayPath && (
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
                  transition={{ duration: DURATION.fast, ease: EASE.standard }}
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
                  transition={{ duration: DURATION.fast, ease: EASE.standard }}
                >
                  <svg className={cls.pathIcon} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                  <span className={cls.pathText}>{displayPath}</span>
                </motion.span>
              )}
            </AnimatePresence>
          </button>
      )}

      {/* 中区：进度条（点击弹出分组总览） */}
      <div className={cls.progressSection} ref={progressRef}>
        <button
          className={cls.progressBtn}
          onClick={() => setShowGroupOverview((v) => !v)}
          title="分组总览"
          aria-label="打开分组总览"
          aria-expanded={showGroupOverview}
        >
          <div className={cls.progressTrack}>
            <div
              className={cls.progressFill}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className={cls.progressText}>
            {currentGroupIndex + 1}/{groupCount}
          </span>
        </button>
        <AnimatePresence>
          {showGroupOverview && (
            <GroupOverviewPopover
              groups={groups}
              currentGroupIndex={currentGroupIndex}
              onSelect={(i) => {
                setShowGroupOverview(false);
                onNavigateGroup(i);
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* 右区：工具按钮 */}
      <div className={cls.toolsSection}>
        {/* 显示选项（视图开关 + 主题 + 快捷键入口） */}
        <ViewOptionsPopover onOpenShortcuts={onOpenShortcuts} />

        {/* 切换目录 */}
        <button
          className={cls.toolBtn}
          onClick={onSwitchFolder}
          title="切换目录 (Ctrl+O)"
          aria-label="切换目录"
        >
          <IconFolder />
        </button>

        <span className={cls.toolSep} />

        {/* 省份选择器 */}
        <div className={cls.popoverAnchor} ref={provincePopoverRef}>
          <button
            className={`${cls.toolBtn} ${cls.toolBtnWithLabel} ${showProvincePopover ? cls.toolBtnActive : ''} ${selectedProvince ? cls.toolBtnActive : ''} ${!hasGroups || reclassifyLoading ? cls.toolBtnDisabled : ''}`}
            onClick={() => hasGroups && !reclassifyLoading && setShowProvincePopover((v) => !v)}
            disabled={!hasGroups || reclassifyLoading}
            title={selectedProvince ? `当前地区: ${selectedProvince.name}` : '选择地区'}
            aria-label="选择地区"
          >
            <IconMap />
            <span className={cls.toolBtnLabel}>
              {selectedProvince ? selectedProvince.name : '地区'}
            </span>
          </button>
          <AnimatePresence>
            {showProvincePopover && (
              <motion.div
                className={cls.provincePopover}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4, transition: { duration: DURATION.fast, ease: EASE.standard } }}
                transition={{ duration: DURATION.normal, ease: EASE.outQuint }}
              >
                <input
                  className={cls.provinceSearch}
                  type="text"
                  placeholder="搜索省份..."
                  value={provinceSearch}
                  onChange={(e) => setProvinceSearch(e.target.value)}
                  autoFocus
                />
                <div className={cls.provinceList}>
                  {selectedProvince && (
                    <button
                      className={`${cls.provinceItem} ${cls.provinceItemClear}`}
                      onClick={() => handleSelectProvince(null)}
                    >
                      清除选择
                    </button>
                  )}
                  {filteredGroups.map((g) => (
                    <div key={g.label}>
                      <div className={cls.regionLabel}>{g.label}</div>
                      {g.provinces.map((p) => (
                        <button
                          key={p.name}
                          className={`${cls.provinceItem} ${selectedProvince?.name === p.name ? cls.provinceItemActive : ''}`}
                          onClick={() => handleSelectProvince(p)}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  ))}
                  {filteredGroups.length === 0 && (
                    <div className={cls.provinceEmpty}>无匹配结果</div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 鸟种统计 */}
        <button
          className={cls.toolBtn}
          onClick={onOpenSpeciesDashboard}
          title="鸟种统计"
          aria-label="鸟种统计"
          disabled={!hasGroups}
        >
          <IconBirdStats />
        </button>

        {/* 设置 */}
        <button
          className={cls.toolBtn}
          onClick={onOpenSettings}
          title="设置"
          aria-label="打开设置"
        >
          <IconSettings />
        </button>

        <span className={cls.toolSep} />

        {/* 选中状态（点击清空） */}
        {selectedCount > 0 && (
          <button
            className={cls.selectionClear}
            onClick={clearSelection}
            title="清空选中"
            aria-label={`已选 ${selectedCount} 张，点击清空`}
          >
            已选 {selectedCount} · 清空
          </button>
        )}

        {/* 导出 */}
        <Button
          variant="primary"
          size="sm"
          disabled={selectedCount === 0}
          onClick={onExport}
          title="导出选中图片 (Ctrl+E)"
        >
          导出
          {selectedCount > 0 && (
            <Badge variant="onPrimary">
              {selectedCount}
            </Badge>
          )}
        </Button>
      </div>
    </motion.div>
  );
}
