import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../stores/useAppStore';
import { useSelectionStore } from '../stores/useSelectionStore';
import { useCanvasStore } from '../stores/useCanvasStore';
import { useToastStore } from '../stores/useToastStore';
import { useProcessing } from '../hooks/useProcessing';
import { useKeyboard } from '../hooks/useKeyboard';
import { useTauriEvents } from '../hooks/useTauriEvents';
import { ProgressDialog } from '../components/dialogs/ProgressDialog';
import InfiniteCanvas, { type InfiniteCanvasHandle } from '../components/canvas/InfiniteCanvas';
import { FloatingGroupNav } from '../components/panels/FloatingGroupNav';
import { FloatingControlBar } from '../components/panels/FloatingControlBar';
import { computeHorizontalLayout, type LayoutResult, type ImageDimension } from '../utils/layout';
import * as imageService from '../services/imageService';
import { runExportFlow } from '../services/exportService';
import type { ImageMetadata } from '../types';
import cls from './MainPage.module.css';

function MainPage() {
  const {
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

  // ── 全选当前分组 ──
  const handleSelectAll = useCallback(() => {
    const { currentGroupIndex } = useCanvasStore.getState();
    const { groups } = useAppStore.getState();
    const group = groups[currentGroupIndex];
    if (group) {
      useSelectionStore.getState().selectAllInGroup(group.pictureHashes);
      canvasRef.current?.syncSelectionVisuals();
    }
  }, []);

  // ── 分组导航回调（左右切换后同步 AppStore） ──
  const handleGroupNavigated = useCallback(() => {
    const { currentGroupIndex } = useCanvasStore.getState();
    const { groups } = useAppStore.getState();
    if (groups[currentGroupIndex]) {
      useAppStore.getState().selectGroup(groups[currentGroupIndex].id);
    }
    canvasRef.current?.syncSelectionVisuals();
  }, []);

  // ── 键盘快捷键 ──
  useKeyboard({
    onOpenFolder: handleOpenFolder,
    onExport: handleExport,
    onGroupNavigated: handleGroupNavigated,
  });

  // ── 监听后台合焦评分（逐张更新） ──
  // 更新 metadataMap 供后续新进入视口的 item 使用
  useTauriEvents<[string, number]>('focus-score-update', ([hash, score]) => {
    const meta = metadataMap.get(hash);
    if (meta) {
      metadataMap.set(hash, { ...meta, focusScore: score });
    }
    // 通知画布直接更新对应 item（绕过 React re-render）
    canvasRef.current?.updateItemMetadata(hash);
  });

  // 创建 memoized fileNames，避免处理完成时频繁重建对象
  const memoizedFileNames = useMemo(() => {
    const nameMap = new Map<string, string>();
    for (const group of groups) {
      for (let i = 0; i < group.pictureHashes.length; i++) {
        const hash = group.pictureHashes[i];
        nameMap.set(hash, group.pictureNames[i] ?? hash);
      }
    }
    return nameMap;
  }, [groups]);

  // 获取当前文件夹并自动触发处理（防 StrictMode double-fire）
  const initCalledRef = useRef(false);
  useEffect(() => {
    if (initCalledRef.current) return;
    initCalledRef.current = true;

    const init = async () => {
      try {
        const folder = await invoke<string | null>('get_current_folder');
        if (!folder) return;

        const info = await invoke<{
          path: string;
          name: string;
          fileCount: number;
          rawCount: number;
        }>('get_folder_info', { path: folder });

        setFolder(folder, info);
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

      // 批量获取元数据
      let metaMap = new Map<string, ImageMetadata>();
      try {
        const metaResult = await imageService.getBatchMetadata(allHashes);
        if (cancelled) return;

        for (const [hash, meta] of Object.entries(metaResult)) {
          metaMap.set(hash, meta);
        }
      } catch (err) {
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

      // 计算水平分组布局
      const viewportWidth = canvasContainerRef.current?.clientWidth ?? window.innerWidth;
      const layoutResult = computeHorizontalLayout(groups, imageDims, viewportWidth);

      if (cancelled) return;

      setFileNames(memoizedFileNames);
      setMetadataMap(metaMap);
      setLayout(layoutResult);

      // 初始化分组导航状态
      useCanvasStore.getState().setGroupCount(groups.length);
      if (groups.length > 0) {
        useAppStore.getState().selectGroup(groups[0].id);
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
      {/* 进度对话框（模态） */}
      <ProgressDialog
        processingState={processingState}
        progress={progress}
        onCancel={handleCancel}
      />

      {/* 画布区域 — 全屏 */}
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
              <FloatingGroupNav
                groups={groups}
                onExport={handleExport}
                onSelectAll={handleSelectAll}
              />
              <FloatingControlBar />
            </div>
          </>
        ) : (
          <div className={cls.placeholder}>
            <p className={cls.placeholderText}>
              {processingState === 'completed' && groups.length === 0
                ? '该目录下未找到 NEF 文件'
                : processingState === 'completed'
                  ? '正在准备画布...'
                  : '等待处理完成...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default MainPage;
