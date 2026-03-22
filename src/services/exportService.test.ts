import { describe, it, expect, vi, beforeEach } from 'vitest';
import { selectExportDir, exportImages } from './exportService';

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);

describe('exportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selectExportDir should call invoke', async () => {
    mockInvoke.mockResolvedValueOnce('/export/dir');
    const result = await selectExportDir();
    expect(mockInvoke).toHaveBeenCalledWith('select_export_dir');
    expect(result).toBe('/export/dir');
  });

  it('exportImages should call invoke with correct params', async () => {
    const exportResult = { exportedCount: 2, targetDir: '/export', errors: [] };
    mockInvoke.mockResolvedValueOnce(exportResult);

    const result = await exportImages(['hash1', 'hash2'], '/export/dir');
    expect(mockInvoke).toHaveBeenCalledWith('export_images', {
      hashes: ['hash1', 'hash2'],
      targetDir: '/export/dir',
    });
    expect(result).toEqual(exportResult);
  });
});
