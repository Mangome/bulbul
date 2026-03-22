import { useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { useTauriEvents } from './useTauriEvents';
import * as processService from '../services/processService';
import type { ProcessingProgress, GroupResult } from '../types';

/**
 * 处理流水线生命周期 Hook
 *
 * 封装：
 * - startProcessing: 启动处理
 * - cancelProcessing: 取消处理
 * - 自动监听进度事件并同步到 Store
 * - 处理完成/失败回调
 */
export function useProcessing() {
  const {
    processingState,
    setProcessingState,
    updateProgress,
    setGroups,
  } = useAppStore();

  const completedUnlistenRef = useRef<(() => void) | null>(null);
  const failedUnlistenRef = useRef<(() => void) | null>(null);

  // 监听进度事件
  useTauriEvents<ProcessingProgress>('processing-progress', (progress) => {
    updateProgress(progress);
    setProcessingState(progress.state);
  });

  // 监听完成事件
  useTauriEvents<GroupResult>('processing-completed', (result) => {
    setGroups(result.groups, result.totalImages);
    setProcessingState('completed');
  });

  // 监听失败事件
  useTauriEvents<string>('processing-failed', (error) => {
    console.error('处理失败:', error);
    setProcessingState('error');
  });

  // 清理
  useEffect(() => {
    return () => {
      completedUnlistenRef.current?.();
      failedUnlistenRef.current?.();
    };
  }, []);

  const startProcessing = useCallback(
    async (folderPath: string) => {
      try {
        setProcessingState('scanning');
        await processService.processFolder(folderPath);
      } catch (err) {
        console.error('处理失败:', err);
        setProcessingState('error');
      }
    },
    [setProcessingState],
  );

  const cancelProcessing = useCallback(async () => {
    try {
      setProcessingState('cancelling');
      await processService.cancelProcessing();
    } catch (err) {
      console.error('取消失败:', err);
    }
  }, [setProcessingState]);

  return {
    processingState,
    startProcessing,
    cancelProcessing,
  };
}
