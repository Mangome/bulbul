import { describe, it, expect, vi } from 'vitest';
import { selectFolder, getFolderInfo, scanImageFiles } from './fileService';

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);

describe('fileService', () => {
  it('selectFolder should call invoke with correct command', async () => {
    mockInvoke.mockResolvedValueOnce('/path/to/folder');
    const result = await selectFolder();
    expect(mockInvoke).toHaveBeenCalledWith('select_folder');
    expect(result).toBe('/path/to/folder');
  });

  it('getFolderInfo should call invoke with correct params', async () => {
    const folderInfo = { path: '/path', name: 'test', fileCount: 10, imageCount: 5 };
    mockInvoke.mockResolvedValueOnce(folderInfo);

    const result = await getFolderInfo('/path');
    expect(mockInvoke).toHaveBeenCalledWith('get_folder_info', { path: '/path' });
    expect(result).toEqual(folderInfo);
  });

  it('scanImageFiles should call invoke with correct params', async () => {
    const scanResult = { files: ['/a.nef', '/b.nef'], count: 2 };
    mockInvoke.mockResolvedValueOnce(scanResult);

    const result = await scanImageFiles('/path');
    expect(mockInvoke).toHaveBeenCalledWith('scan_image_files', { path: '/path' });
    expect(result).toEqual(scanResult);
  });
});
