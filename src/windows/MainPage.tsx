import { useEffect, useCallback, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../stores/useAppStore';
import { useProcessing } from '../hooks/useProcessing';
import { ProgressDialog } from '../components/dialogs/ProgressDialog';
import InfiniteCanvas from '../components/canvas/InfiniteCanvas';
import { computeWaterfallLayout, type LayoutResult, type ImageDimension } from '../utils/layout';
import * as imageService from '../services/imageService';
import type { ImageMetadata } from '../types';

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
  const canvasContainerRef = useRef<HTMLDivElement>(null);

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
    };

    prepareCanvas();
    return () => { cancelled = true; };
  }, [processingState, groups]);

  const handleCancel = useCallback(async () => {
    await cancelProcessing();
  }, [cancelProcessing]);

  const isCanvasReady = processingState === 'completed' && layout !== null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Bulbul 主工作区</h1>
        <p style={styles.subtitle}>
          {currentFolder
            ? `文件夹: ${currentFolder}`
            : '等待加载文件夹...'}
        </p>
      </div>

      {/* 完成状态摘要 */}
      {processingState === 'completed' && progress && (
        <div style={styles.statusBar}>
          <span style={styles.statusText}>
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
      <div ref={canvasContainerRef} style={styles.canvasArea}>
        {isCanvasReady ? (
          <InfiniteCanvas
            layout={layout}
            fileNames={fileNames}
            metadataMap={metadataMap}
          />
        ) : (
          <div style={styles.placeholder}>
            <p style={styles.placeholderText}>
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

// ─── 样式 ─────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: 'var(--color-bg-primary)',
  },
  header: {
    padding: 'var(--spacing-md) var(--spacing-lg)',
    borderBottom: '1px solid var(--color-border)',
  },
  title: {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  subtitle: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-muted)',
    margin: '4px 0 0',
    wordBreak: 'break-all' as const,
  },
  statusBar: {
    padding: '12px var(--spacing-lg)',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-bg-secondary)',
  },
  statusText: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  canvasArea: {
    flex: 1,
    position: 'relative' as const,
    overflow: 'hidden',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-bg-secondary)',
  },
  placeholderText: {
    fontSize: 'var(--font-size-lg)',
    color: 'var(--color-text-muted)',
  },
};

export default MainPage;
