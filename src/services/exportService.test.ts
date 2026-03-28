import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @tauri-apps/api 模块
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

import { invoke } from '@tauri-apps/api/core';
import { runExportFlow } from './exportService';

const mockInvoke = vi.mocked(invoke);

describe('exportService', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
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
});
