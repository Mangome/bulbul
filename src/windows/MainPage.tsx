import { useEffect, useCallback, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../stores/useAppStore';
import { useSelectionStore } from '../stores/useSelectionStore';
import { useToastStore } from '../stores/useToastStore';
import { useProcessing } from '../hooks/useProcessing';
import { useKeyboard } from '../hooks/useKeyboard';
import { ProgressDialog } from '../components/dialogs/ProgressDialog';
import InfiniteCanvas, { type InfiniteCanvasHandle } from '../components/canvas/InfiniteCanvas';
import { FloatingGroupList } from '../components/panels/FloatingGroupList';
import { FloatingControlBar } from '../components/panels/FloatingControlBar';
import { computeWaterfallLayout, type LayoutResult, type ImageDimension } from '../utils/layout';
import * as imageService from '../services/imageService';
import { runExportFlow } from '../services/exportService';
import type { ImageMetadata } from '../types';
import cls from './MainPage.module.css';

function MainPage() {
  const {
    currentFolder,
    processingState,
    progress,
    groups,
    setFolder,
  } = useAppStore();

  const { startProcessing, cancelProcessing } = useProcessing();

  // ── 画布数据状态 ──
  const [layout, setLayout] = useState<LayoutResult | null>(null);
  const [fileNames, setFileNames] = useState<Map<string, string>>(new Map());
  const [metadataMap, setMetadataMap] = useState<Map<string, ImageMetadata>>(new Map());
  const [thumbnailUrls, setThumbnailUrls] = useState<Map<string, string>>(new Map());
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<InfiniteCanvasHandle>(null);

  const { addToast } = useToastStore();

  // ── 导出流程 ──
  const handleExport = useCallback(async () => {
    const { selectedHashes } = useSelectionStore.getState();
    const hashes = Array.from(selectedHashes);
    if (hashes.length === 0) return;

    const result = await runExportFlow(hashes);

    if (result.cancelled) return;

    if (result.success && result.result) {
      const r = result.result;
      if (r.failedFiles.length > 0) {
        addToast({
          type: 'warning',
          message: `导出完成：成功 ${r.exportedCount}/${r.totalCount}，失败 ${r.failedFiles.length}`,
        });
      } else {
        addToast({
          type: 'success',
          message: `导出完成：成功导出 ${r.exportedCount} 张图片到 ${r.targetDir}`,
        });
      }
      useSelectionStore.getState().clearSelection();
      canvasRef.current?.syncSelectionVisuals();
    } else if (result.error) {
      addToast({ type: 'error', message: `导出失败：${result.error}` });
    }
  }, [addToast]);

  // ── 打开文件夹（键盘快捷键回调） ──
  const handleOpenFolder = useCallback(async () => {
    try {
      const folder = await invoke<string | null>('select_folder');
      if (!folder) return;
      const info = await invoke<{
        path: string; name: string; fileCount: number; rawCount: number;
      }>('get_folder_info', { path: folder });
      setFolder(folder, info);
      await startProcessing(folder);
    } catch (err) {
      console.error('打开文件夹失败:', err);
    }
  }, [setFolder, startProcessing]);

  // ── 分组跳转回调 ──
  const handleGroupClick = useCallback(
    (groupId: number) => {
      useAppStore.getState().selectGroup(groupId);
      // 计算目标分组在布局中的 Y 坐标
      if (layout) {
        const titleItem = layout.groupTitles.find(
          (t) => t.groupId === groupId,
        );
        if (titleItem && canvasRef.current) {
          canvasRef.current.scrollToY(titleItem.y);
        }
      }
    },
    [layout],
  );

  // ── 键盘快捷键分组导航后滚动 ──
  const handleGroupNavigated = useCallback(() => {
    if (!layout) return;
    const { selectedGroupId } = useAppStore.getState();
    if (selectedGroupId == null) return;
    const titleItem = layout.groupTitles.find(
      (t) => t.groupId === selectedGroupId,
    );
    if (titleItem && canvasRef.current) {
      canvasRef.current.scrollToY(titleItem.y);
    }
  }, [layout]);

  // ── 键盘快捷键 ──
  useKeyboard({
    onOpenFolder: handleOpenFolder,
    onExport: handleExport,
    onGroupNavigated: handleGroupNavigated,
  });

  // 获取当前文件夹并自动触发处理（防 StrictMode double-fire）
  const initCalledRef = useRef(false);
  useEffect(() => {
    if (initCalledRef.current) return;
    initCalledRef.current = true;

    const init = async () => {
      try {
        const folder = await invoke<string | null>('get_current_folder');
        if (!folder) return;

        // 获取文件夹信息
        const info = await invoke<{
          path: string;
          name: string;
          fileCount: number;
          rawCount: number;
        }>('get_folder_info', { path: folder });

        setFolder(folder, info);

        // 自动触发处理
        await startProcessing(folder);
      } catch (err) {
        console.error('处理初始化失败:', err);
      }
    };

    init();
  }, [setFolder, startProcessing]);

  // ── 处理完成后：获取元数据 + 计算布局 ──
  useEffect(() => {
    if (processingState !== 'completed') return;
    if (groups.length === 0) return;

    let cancelled = false;

    const prepareCanvas = async () => {
      // 收集所有 hash
      const allHashes: string[] = [];
      const nameMap = new Map<string, string>();

      for (const group of groups) {
        for (let i = 0; i < group.pictureHashes.length; i++) {
          const hash = group.pictureHashes[i];
          allHashes.push(hash);
          nameMap.set(hash, group.pictureNames[i] ?? hash);
        }
      }

      if (cancelled) return;

      // 批量获取元数据 — Rust 返回 HashMap<String, ImageMetadata>
      let metaMap = new Map<string, ImageMetadata>();
      try {
        const metaResult = await imageService.getBatchMetadata(allHashes);
        if (cancelled) return;

        for (const [hash, meta] of Object.entries(metaResult)) {
          metaMap.set(hash, meta);
        }
      } catch (err) {
        // 元数据获取失败不阻塞画布渲染，使用默认宽高比
        console.warn('元数据获取失败，将使用默认宽高比:', err);
      }

      if (cancelled) return;

      // 构建图片尺寸信息
      const imageDims = new Map<string, ImageDimension>();
      for (const [hash, meta] of metaMap) {
        if (meta.imageWidth && meta.imageHeight) {
          imageDims.set(hash, {
            width: meta.imageWidth,
            height: meta.imageHeight,
          });
        }
      }

      // 计算布局
      const viewportWidth = canvasContainerRef.current?.clientWidth ?? window.innerWidth;
      const layoutResult = computeWaterfallLayout(groups, imageDims, viewportWidth);

      if (cancelled) return;

      setFileNames(nameMap);
      setMetadataMap(metaMap);
      setLayout(layoutResult);

      // 为分组代表图构建缩略图 URL
      const thumbUrls = new Map<string, string>();
      for (const group of groups) {
        try {
          const url = await imageService.getImageUrl(group.representativeHash, 'thumbnail');
          if (url) thumbUrls.set(group.representativeHash, url);
        } catch {
          // 缩略图加载失败不阻塞
        }
      }
      if (!cancelled) {
        setThumbnailUrls(thumbUrls);
      }
    };

    prepareCanvas();
    return () => { cancelled = true; };
  }, [processingState, groups]);

  const handleCancel = useCallback(async () => {
    await cancelProcessing();
  }, [cancelProcessing]);

  const isCanvasReady = processingState === 'completed' && layout !== null;

  return (
    <div className={cls.container}>
      <div className={cls.header}>
        <h1 className={cls.title}>Bulbul 主工作区</h1>
        <p className={cls.subtitle}>
          {currentFolder
            ? `文件夹: ${currentFolder}`
            : '等待加载文件夹...'}
        </p>
      </div>

      {/* 完成状态摘要 */}
      {processingState === 'completed' && progress && (
        <div className={cls.statusBar}>
          <span className={cls.statusText}>
            ✅ 处理完成 — 共 {progress.total} 张
          </span>
        </div>
      )}

      {/* 进度对话框（模态） */}
      <ProgressDialog
        processingState={processingState}
        progress={progress}
        onCancel={handleCancel}
      />

      {/* 画布区域 */}
      <div ref={canvasContainerRef} className={cls.canvasArea}>
        {isCanvasReady ? (
          <>
            <InfiniteCanvas
              ref={canvasRef}
              layout={layout}
              fileNames={fileNames}
              metadataMap={metadataMap}
            />

            {/* 悬浮面板层 — pointer-events: none 防止拦截画布事件 */}
            <div className={cls.panelLayer}>
              <FloatingGroupList
                groups={groups}
                thumbnailUrls={thumbnailUrls}
                onGroupClick={handleGroupClick}
              />
              <FloatingControlBar onExport={handleExport} />
            </div>
          </>
        ) : (
          <div className={cls.placeholder}>
            <p className={cls.placeholderText}>
              {processingState === 'completed' && groups.length === 0
                ? '📂 该目录下未找到 NEF 文件'
                : processingState === 'completed'
                  ? '正在准备画布...'
                  : '🖼️ 等待处理完成...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default MainPage;
