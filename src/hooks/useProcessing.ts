import { useCallback } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { useTauriEvents } from './useTauriEvents';
import * as processService from '../services/processService';
import type { ProcessingProgress } from '../types';

/**
 * 处理流水线生命周期 Hook
 *
 * 数据流设计：
 * - 进度信息：通过 Tauri 事件实时推送（processing-progress）
 * - 最终结果：通过 invoke 返回值同步获取（process_folder 的返回值）
 *
 * 不再依赖 processing-completed 事件来设置 groups，
 * 避免 React StrictMode double-fire 导致的事件监听器竞态。
 */
export function useProcessing() {
  const {
    processingState,
    setProcessingState,
    updateProgress,
    setGroups,
  } = useAppStore();

  // 监听进度事件（仅用于实时进度展示）
  // focus_scoring 是后台异步阶段，不更新主 processingState（避免重新弹出进度对话框）
  useTauriEvents<ProcessingProgress>('processing-progress', (progress) => {
    if (progress.state === 'focus_scoring') return;
    updateProgress(progress);
    setProcessingState(progress.state);
  });

  const startProcessing = useCallback(
    async (folderPath: string) => {
      try {
        setProcessingState('scanning');
        const result = await processService.processFolder(folderPath);
        setGroups(result.groups, result.totalImages);
      } catch (err) {
        console.error('处理失败:', err);
        setProcessingState('error');
      }
    },
    [setProcessingState, setGroups],
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
