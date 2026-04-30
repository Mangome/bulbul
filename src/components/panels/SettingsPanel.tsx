// ============================================================
// 设置面板 (SettingsPanel)
//
// 右侧滑出抽屉，包含四个区域：分组参数、外观设置、版本更新、缓存管理。
// 使用 motion/react 滑入动画 + 半透明遮罩。
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
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
      <path d="M11.5 3.5l-8 8M3.5 3.5l8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
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

  // 处理是否处于活跃状态（需要先取消才能清理缓存）
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

  // 打开时自动查询缓存大小并读取当前版本
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

    // 正在处理中：先取消，取消完成后自动清理
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

  // 点击确认按钮后 3 秒自动取消确认状态
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

            {/* 分组参数 */}
            <div className={cls.section}>
              <div className={cls.sectionTitle}>分组参数</div>
              <div className={cls.sliderRow}>
                <div className={cls.sliderLabel}>
                  <span className={cls.sliderLabelText}>相似度</span>
                  <span className={cls.sliderValue}>{Math.round(similarityThreshold)}%</span>
                </div>
                <Slider
                  min={50}
                  max={100}
                  value={Math.round(similarityThreshold)}
                  step={1}
                  onChange={handleSimilarityChange}
                  aria-label="相似度阈值"
                />
              </div>
              <div className={cls.sliderRow}>
                <div className={cls.sliderLabel}>
                  <span className={cls.sliderLabelText}>时间间隔</span>
                  <span className={cls.sliderValue}>{timeGapSeconds}s</span>
                </div>
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

            {/* 外观设置 */}
            <div className={cls.section}>
              <div className={cls.sectionTitle}>外观</div>
              <div className={cls.toggleRow}>
                <span className={cls.toggleLabel}>检测框覆盖层</span>
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

            {/* 版本更新 */}
            <div className={cls.section}>
              <div className={cls.sectionTitle}>版本更新</div>

              <div className={cls.updateMeta}>
                <div className={cls.updateRow}>
                  <span className={cls.updateLabel}>当前版本</span>
                  <span className={cls.updateValue}>{currentVersion ? `v${currentVersion}` : '读取中...'}</span>
                </div>
                {updateInfo && (
                  <div className={cls.updateRow}>
                    <span className={cls.updateLabel}>最新版本</span>
                    <span className={cls.updateValue}>v{updateInfo.version}</span>
                  </div>
                )}
              </div>

              {updateMessage && (
                <div
                  className={`${cls.updateStatus} ${updateStatus === 'error' ? cls.updateStatusError : ''}`}
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

              <div className={cls.updateActions}>
                <button
                  className={cls.updateCheckBtn}
                  onClick={() => void handleCheckUpdate()}
                  disabled={isUpdateBusy}
                >
                  {updateStatus === 'checking' ? '检查中...' : '检查更新'}
                </button>
                {updateInfo && (
                  <button
                    className={cls.updateInstallBtn}
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

            {/* 缓存管理 */}
            <div className={cls.section}>
              <div className={cls.sectionTitle}>缓存管理</div>

              {cacheError ? (
                <div className={cls.cacheError}>无法获取缓存信息</div>
              ) : (
                <div className={cls.cacheInfo}>
                  {cacheInfo && (
                    <>
                      <div className={cls.cachePath}>{cacheInfo.cacheDir}</div>
                      <div className={cls.cacheStats}>
                        <span className={cls.cacheSize}>
                          {formatCacheSize(cacheInfo.totalSize)}
                        </span>
                        <span className={cls.cacheFileCount}>
                          {cacheInfo.fileCount} 个文件
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className={cls.cacheActions}>
                <button
                  className={cls.reprocessBtn}
                  onClick={() => currentFolder && startProcessing(currentFolder, true)}
                  disabled={!currentFolder || isActive || processingState === 'cancelling'}
                  title="强制重新处理当前目录"
                  aria-label="重新处理"
                >
                  重新处理
                </button>
                <button
                  className={cls.refreshBtn}
                  onClick={() => void fetchCacheSize()}
                  disabled={cacheLoading || clearingCache}
                  title="刷新缓存信息"
                  aria-label="刷新缓存信息"
                >
                  <span className={cacheLoading ? cls.spinning : ''}>
                    <IconRefresh />
                  </span>
                </button>
                <button
                  className={`${cls.clearBtn} ${confirmClear ? cls.confirmBtn : ''}`}
                  onClick={handleClearClick}
                  disabled={clearingCache || processingState === 'cancelling'}
                >
                  {clearingCache
                    ? '清理中...'
                    : processingState === 'cancelling'
                      ? '正在停止处理...'
                      : confirmClear
                        ? isActive
                          ? '停止并清理'
                          : '确认清理'
                        : '清理缓存'}
                </button>
              </div>
            </div>

            {/* 关于 */}
            <div className={cls.section}>
              <button className={cls.aboutBtn} onClick={onOpenAbout}>
                <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
                  <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M7.5 10V7M7.5 5h.007" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <span>关于 Bulbul</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
