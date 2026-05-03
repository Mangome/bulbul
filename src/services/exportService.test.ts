import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @tauri-apps/api 模块
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { runExportFlow } from './exportService';
import type { ExportProgress } from './exportService';

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);

describe('exportService', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockListen.mockReset();
    mockListen.mockResolvedValue(() => {});
  });

  it('空 hashes 列表返回错误', async () => {
    const result = await runExportFlow([]);
    expect(result.success).toBe(false);
    expect(result.error).toBe('没有选中图片');
  });

  it('用户取消目录选择时返回 cancelled', async () => {
    mockInvoke.mockResolvedValueOnce(null); // select_export_dir returns null
    const result = await runExportFlow(['h1', 'h2']);
    expect(result.cancelled).toBe(true);
    expect(result.success).toBe(false);
  });

  it('成功导出返回结果', async () => {
    const exportResult = {
      exportedCount: 2,
      totalCount: 2,
      targetDir: 'D:\\exports',
      failedFiles: [],
    };
    mockInvoke
      .mockResolvedValueOnce('D:\\exports') // select_export_dir
      .mockResolvedValueOnce(exportResult); // export_images

    const result = await runExportFlow(['h1', 'h2']);
    expect(result.success).toBe(true);
    expect(result.result).toEqual(exportResult);
  });

  it('导出失败返回错误信息', async () => {
    mockInvoke
      .mockResolvedValueOnce('D:\\exports') // select_export_dir
      .mockRejectedValueOnce(new Error('IO 错误')); // export_images

    const result = await runExportFlow(['h1']);
    expect(result.success).toBe(false);
    expect(result.error).toBe('IO 错误');
  });

  it('参数正确传递给 invoke', async () => {
    const exportResult = {
      exportedCount: 1,
      totalCount: 1,
      targetDir: 'D:\\out',
      failedFiles: [],
    };
    mockInvoke
      .mockResolvedValueOnce('D:\\out')
      .mockResolvedValueOnce(exportResult);

    await runExportFlow(['hash_abc']);

    expect(mockInvoke).toHaveBeenCalledWith('select_export_dir');
    expect(mockInvoke).toHaveBeenCalledWith('export_images', {
      hashes: ['hash_abc'],
      targetDir: 'D:\\out',
    });
  });

  it('onProgress 回调接收含新字段的进度', async () => {
    const exportResult = {
      exportedCount: 2,
      totalCount: 2,
      targetDir: 'D:\\exports',
      failedFiles: [],
    };

    let capturedListener: ((event: { payload: ExportProgress }) => void) | null = null;
    mockListen.mockImplementationOnce((_event, handler) => {
      capturedListener = handler as (event: { payload: ExportProgress }) => void;
      return Promise.resolve(() => {});
    });

    mockInvoke
      .mockResolvedValueOnce('D:\\exports')
      .mockImplementationOnce(async () => {
        // 模拟后端发送进度事件
        if (capturedListener) {
          capturedListener({
            payload: { current: 1, total: 2, currentFile: 'IMG_001.nef', elapsedMs: 5000 },
          });
          capturedListener({
            payload: { current: 2, total: 2, currentFile: 'IMG_002.nef', elapsedMs: 12000 },
          });
        }
        return exportResult;
      });

    const progressCalls: ExportProgress[] = [];
    const result = await runExportFlow(['h1', 'h2'], (p) => progressCalls.push(p));

    expect(result.success).toBe(true);
    expect(progressCalls).toHaveLength(2);
    expect(progressCalls[0]).toEqual({
      current: 1, total: 2, currentFile: 'IMG_001.nef', elapsedMs: 5000,
    });
    expect(progressCalls[1]).toEqual({
      current: 2, total: 2, currentFile: 'IMG_002.nef', elapsedMs: 12000,
    });
  });
});
