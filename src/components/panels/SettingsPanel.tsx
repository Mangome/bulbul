// ============================================================
// 设置面板 (SettingsPanel)
//
// Apple 系统设置风格：圆角分组卡片 + 行式布局。
// 每个分组用独立卡片包裹，行内左标签右控件。
// ============================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Slider } from '../common/Slider';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useGroupingStore } from '../../stores/useGroupingStore';
import { useAppStore } from '../../stores/useAppStore';
import { useProcessing } from '../../hooks/useProcessing';
import { getCacheSize, clearCache, formatCacheSize } from '../../services/cacheService';
import {
  checkForUpdate,
  downloadAndInstallUpdate,
  getCurrentVersion,
} from '../../services/updaterService';
import type { CacheSizeInfo } from '../../services/cacheService';
import type { AvailableUpdateInfo } from '../../services/updaterService';
import type { ProcessingState } from '../../types';
import cls from './SettingsPanel.module.css';

// ─── Props ────────────────────────────────────────────

export interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  onCacheCleared?: () => void;
  onOpenAbout?: () => void;
  processingState: ProcessingState;
}

// ─── SVG 图标 ────────────────────────────────────────

function IconClose() {
  return (
    <svg width="12" height="12" viewBox="0 0 15 15" fill="none">
      <path d="M11.5 3.5l-8 8M3.5 3.5l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <path d="M1.5 7.5a6 6 0 0 1 10.9-3.5M13.5 7.5a6 6 0 0 1-10.9 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 1v3h-3M2.5 14v-3h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 分组参数图标：网格/聚类 */
function IconGrouping() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <rect x="1.5" y="1.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9" y="1.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="1.5" y="9" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** 外观图标：画笔/调色板 */
function IconAppearance() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="5.5" cy="5.5" r="1" fill="currentColor" />
      <circle cx="9.5" cy="5.5" r="1" fill="currentColor" />
      <circle cx="5.5" cy="9.5" r="1" fill="currentColor" />
      <circle cx="9.5" cy="9" r="1" fill="currentColor" />
    </svg>
  );
}

/** 缓存图标：硬盘/存储 */
function IconCache() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <rect x="1.5" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <line x1="1.5" y1="9" x2="13.5" y2="9" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="10.5" cy="11" r="0.7" fill="currentColor" />
    </svg>
  );
}

/** 更新图标：下载箭头 */
function IconUpdate() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 2v7M4.5 6l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 10.5v1a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** 关于图标：信息圆 */
function IconAbout() {
  return (
    <svg width="12" height="12" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7.5 10V7M7.5 5h.007" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// ─── 组件 ─────────────────────────────────────────────

type UpdateStatus = 'idle' | 'checking' | 'upToDate' | 'available' | 'downloading' | 'installing' | 'error';

export function SettingsPanel({ open, onClose, onCacheCleared, onOpenAbout, processingState }: SettingsPanelProps) {
  // 分组参数
  const similarityThreshold = useGroupingStore((s) => s.similarityThreshold);
  const timeGapSeconds = useGroupingStore((s) => s.timeGapSeconds);
  const setSimilarityThreshold = useGroupingStore((s) => s.setSimilarityThreshold);
  const setTimeGapSeconds = useGroupingStore((s) => s.setTimeGapSeconds);
  const hasGroups = useAppStore((s) => s.groups.length > 0);
  const currentFolder = useAppStore((s) => s.currentFolder);
  const { startProcessing, cancelProcessing, regroupWith } = useProcessing();

  // 处理是否处于活跃状态
  const isActive = processingState === 'scanning'
    || processingState === 'processing'
    || processingState === 'analyzing'
    || processingState === 'grouping'
    || processingState === 'focus_scoring';

  // 检测框
  const showDetectionOverlay = useCanvasStore((s) => s.showDetectionOverlay);
  const toggleDetectionOverlay = useCanvasStore((s) => s.toggleDetectionOverlay);

  // 缓存
  const [cacheInfo, setCacheInfo] = useState<CacheSizeInfo | null>(null);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [cacheError, setCacheError] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // 更新
  const [currentVersion, setCurrentVersion] = useState('');
  const [updateInfo, setUpdateInfo] = useState<AvailableUpdateInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [updateMessage, setUpdateMessage] = useState('');
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState<number | null>(null);

  const regroupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelAndClearRef = useRef(false);

  const isUpdateBusy = updateStatus === 'checking'
    || updateStatus === 'downloading'
    || updateStatus === 'installing';

  const fetchCacheSize = useCallback(async () => {
    setCacheLoading(true);
    setCacheError(false);
    try {
      const info = await getCacheSize();
      setCacheInfo(info);
    } catch {
      setCacheError(true);
    } finally {
      setCacheLoading(false);
    }
  }, []);

  const loadCurrentVersion = useCallback(async () => {
    try {
      const version = await getCurrentVersion();
      setCurrentVersion(version);
    } catch {
      setCurrentVersion('');
    }
  }, []);

  // 打开时自动查询
  useEffect(() => {
    if (open) {
      void fetchCacheSize();
      void loadCurrentVersion();
      setConfirmClear(false);
    }
  }, [open, fetchCacheSize, loadCurrentVersion]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // 防抖触发 regroup
  const scheduleRegroup = useCallback(
    (similarity: number, timeGap: number) => {
      if (!hasGroups) return;
      if (regroupTimerRef.current) clearTimeout(regroupTimerRef.current);
      regroupTimerRef.current = setTimeout(() => {
        regroupTimerRef.current = null;
        regroupWith(similarity, timeGap);
      }, 500);
    },
    [hasGroups, regroupWith],
  );

  const handleSimilarityChange = useCallback(
    (value: number) => {
      setSimilarityThreshold(value);
      scheduleRegroup(value, useGroupingStore.getState().timeGapSeconds);
    },
    [setSimilarityThreshold, scheduleRegroup],
  );

  const handleTimeGapChange = useCallback(
    (value: number) => {
      setTimeGapSeconds(value);
      scheduleRegroup(useGroupingStore.getState().similarityThreshold, value);
    },
    [setTimeGapSeconds, scheduleRegroup],
  );

  const executeClearCache = useCallback(async () => {
    setClearingCache(true);
    try {
      await clearCache();
      setConfirmClear(false);
      onCacheCleared?.();
      await fetchCacheSize();
    } catch (err) {
      console.error('清理缓存失败:', err);
      setCacheError(true);
    } finally {
      setClearingCache(false);
    }
  }, [onCacheCleared, fetchCacheSize]);

  const handleCheckUpdate = useCallback(async () => {
    if (isUpdateBusy) return;

    setUpdateStatus('checking');
    setUpdateMessage('正在检查更新...');
    setDownloadedBytes(0);
    setTotalBytes(null);

    try {
      const result = await checkForUpdate();
      const nextCurrentVersion = result.available ? result.update.currentVersion : result.currentVersion;
      setCurrentVersion(nextCurrentVersion);

      if (!result.available) {
        setUpdateInfo(null);
        setUpdateStatus('upToDate');
        setUpdateMessage('当前已是最新版本');
        return;
      }

      setUpdateInfo(result.update);
      setUpdateStatus('available');
      setUpdateMessage(`发现新版本 v${result.update.version}`);
    } catch (err) {
      setUpdateStatus('error');
      setUpdateMessage(err instanceof Error ? err.message : '检查更新失败');
    }
  }, [isUpdateBusy]);

  const handleInstallUpdate = useCallback(async () => {
    if (isUpdateBusy || !updateInfo) return;

    setUpdateStatus('downloading');
    setUpdateMessage('正在下载更新...');
    setDownloadedBytes(0);
    setTotalBytes(null);

    try {
      await downloadAndInstallUpdate((progress) => {
        setDownloadedBytes(progress.downloadedBytes);
        setTotalBytes(progress.totalBytes);

        if (progress.stage === 'installing') {
          setUpdateStatus('installing');
          setUpdateMessage('安装完成，正在重启应用...');
          return;
        }

        setUpdateStatus('downloading');
        setUpdateMessage('正在下载更新...');
      });

      setUpdateStatus('installing');
      setUpdateMessage('安装完成，正在重启应用...');
    } catch (err) {
      setUpdateInfo(null);
      setUpdateStatus('error');
      setUpdateMessage(err instanceof Error ? `${err.message} 请重新检查更新后再试。` : '安装更新失败，请重新检查更新后再试。');
    }
  }, [isUpdateBusy, updateInfo]);

  const handleClearClick = useCallback(() => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }

    if (isActive) {
      cancelAndClearRef.current = true;
      cancelProcessing();
      return;
    }

    void executeClearCache();
  }, [confirmClear, isActive, cancelProcessing, executeClearCache]);

  // 取消完成后自动执行清理
  useEffect(() => {
    if (!cancelAndClearRef.current) return;
    if (processingState !== 'cancelled' && processingState !== 'error') return;
    cancelAndClearRef.current = false;
    void executeClearCache();
  }, [processingState, executeClearCache]);

  // 确认按钮 3 秒后自动取消
  useEffect(() => {
    if (!confirmClear) return;
    const timer = setTimeout(() => setConfirmClear(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmClear]);

  const updateProgressText = updateStatus === 'downloading'
    ? totalBytes !== null
      ? `${formatCacheSize(downloadedBytes)} / ${formatCacheSize(totalBytes)}`
      : downloadedBytes > 0
        ? formatCacheSize(downloadedBytes)
        : ''
    : '';

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
          {/* 遮罩 */}
          <div className={cls.backdrop} onClick={onClose} />

          {/* 面板 */}
          <motion.div
            className={cls.panel}
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* 头部 */}
            <div className={cls.header}>
              <span className={cls.title}>设置</span>
              <button className={cls.closeBtn} onClick={onClose} aria-label="关闭设置">
                <IconClose />
              </button>
            </div>

            <div className={cls.content}>
              {/* ── 分组参数 ── */}
              <div className={cls.group}>
                <div className={cls.groupHeader}>
                  <span className={cls.groupIcon}>
                    <IconGrouping />
                  </span>
                  <span className={cls.groupTitle}>分组参数</span>
                </div>

                {/* 相似度 */}
                <div className={cls.row}>
                  <span className={cls.rowLabel}>相似度</span>
                  <span className={cls.rowValue}>{Math.round(similarityThreshold)}%</span>
                </div>
                <div className={cls.sliderRow}>
                  <Slider
                    min={50}
                    max={100}
                    value={Math.round(similarityThreshold)}
                    step={1}
                    onChange={handleSimilarityChange}
                    aria-label="相似度阈值"
                  />
                </div>

                <div className={cls.separator} />

                {/* 时间间隔 */}
                <div className={cls.row}>
                  <span className={cls.rowLabel}>时间间隔</span>
                  <span className={cls.rowValue}>{timeGapSeconds}s</span>
                </div>
                <div className={cls.sliderRow}>
                  <Slider
                    min={1}
                    max={120}
                    value={timeGapSeconds}
                    step={1}
                    onChange={handleTimeGapChange}
                    aria-label="时间间隔阈值"
                  />
                </div>
              </div>

              {/* ── 外观 ── */}
              <div className={cls.group}>
                <div className={cls.groupHeader}>
                  <span className={cls.groupIcon}>
                    <IconAppearance />
                  </span>
                  <span className={cls.groupTitle}>外观</span>
                </div>

                <div className={cls.row}>
                  <span className={cls.rowLabel}>检测框覆盖层</span>
                  <button
                    className={`${cls.toggle} ${showDetectionOverlay ? cls.toggleActive : ''}`}
                    onClick={toggleDetectionOverlay}
                    role="switch"
                    aria-checked={showDetectionOverlay}
                    aria-label="检测框覆盖层开关"
                  >
                    <span className={cls.toggleKnob} />
                  </button>
                </div>
              </div>

              {/* ── 缓存管理 ── */}
              <div className={cls.group}>
                <div className={cls.groupHeader}>
                  <span className={cls.groupIcon}>
                    <IconCache />
                  </span>
                  <span className={cls.groupTitle}>缓存管理</span>
                  <button
                    className={cls.iconBtn}
                    onClick={() => void fetchCacheSize()}
                    disabled={cacheLoading || clearingCache}
                    title="刷新缓存信息"
                    aria-label="刷新缓存信息"
                  >
                    <span className={cacheLoading ? cls.spinning : ''}>
                      <IconRefresh />
                    </span>
                  </button>
                </div>

                {cacheError ? (
                  <div className={cls.row}>
                    <span className={cls.cacheError}>无法获取缓存信息</span>
                  </div>
                ) : (
                  <>
                    <div className={cls.row}>
                      <div className={cls.cacheValueRow}>
                        <span className={cls.cacheSize}>
                          {cacheInfo ? formatCacheSize(cacheInfo.totalSize) : '—'}
                        </span>
                        {cacheInfo && (
                          <span className={cls.cacheFileCount}>
                            {cacheInfo.fileCount} 个文件
                          </span>
                        )}
                      </div>
                    </div>
                    {cacheInfo && (
                      <div className={cls.cachePath}>{cacheInfo.cacheDir}</div>
                    )}
                  </>
                )}

                <div className={cls.separator} />

                <div className={cls.actionsRow}>
                  <button
                    className={`${cls.actionBtn} ${cls.actionBtnTinted}`}
                    onClick={() => currentFolder && startProcessing(currentFolder, true)}
                    disabled={!currentFolder || isActive || processingState === 'cancelling'}
                    title="强制重新处理当前目录"
                    aria-label="重新处理"
                  >
                    重新处理
                  </button>
                  <button
                    className={`${cls.actionBtn} ${confirmClear ? cls.actionBtnConfirmDanger : cls.actionBtnDanger}`}
                    onClick={handleClearClick}
                    disabled={clearingCache || processingState === 'cancelling'}
                  >
                    {clearingCache
                      ? '清理中...'
                      : processingState === 'cancelling'
                        ? '正在停止...'
                        : confirmClear
                          ? isActive
                            ? '停止并清理'
                            : '确认清理'
                          : '清理缓存'}
                  </button>
                </div>
              </div>

              {/* ── 版本更新 ── */}
              <div className={cls.group}>
                <div className={cls.groupHeader}>
                  <span className={cls.groupIcon}>
                    <IconUpdate />
                  </span>
                  <span className={cls.groupTitle}>版本更新</span>
                  <span className={cls.groupHeaderMeta}>
                    {currentVersion ? `v${currentVersion}` : ''}
                  </span>
                </div>

                {updateMessage && (
                  <div
                    className={`${cls.updateBanner} ${updateStatus === 'error' ? cls.updateBannerError : ''} ${updateStatus === 'upToDate' ? cls.updateBannerSuccess : ''}`}
                    role={updateStatus === 'error' ? 'alert' : 'status'}
                  >
                    {updateMessage}
                  </div>
                )}

                {updateProgressText && (
                  <div className={cls.updateProgress}>{updateProgressText}</div>
                )}

                {updateInfo?.notes && (
                  <div className={cls.updateNotes}>
                    <div className={cls.updateNotesTitle}>更新说明</div>
                    <div className={cls.updateNotesBody}>{updateInfo.notes}</div>
                  </div>
                )}

                <div className={cls.actionsRow}>
                  <button
                    className={`${cls.actionBtn} ${cls.actionBtnDefault}`}
                    onClick={() => void handleCheckUpdate()}
                    disabled={isUpdateBusy}
                  >
                    {updateStatus === 'checking' ? '检查中...' : '检查更新'}
                  </button>
                  {updateInfo && (
                    <button
                      className={`${cls.actionBtn} ${cls.actionBtnPrimary}`}
                      onClick={() => void handleInstallUpdate()}
                      disabled={isUpdateBusy}
                    >
                      {updateStatus === 'downloading'
                        ? '下载中...'
                        : updateStatus === 'installing'
                          ? '安装中...'
                          : '下载并安装'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── 底部 ── */}
            <div className={cls.footer}>
              {currentVersion && (
                <span className={cls.footerVersion}>Bulbul v{currentVersion}</span>
              )}
              <button className={cls.footerAbout} onClick={onOpenAbout}>
                <IconAbout />
                <span>关于 Bulbul</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
