import { describe, it, expect, vi } from 'vitest';
import { getCacheSize, clearCache, formatCacheSize } from './cacheService';

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);

describe('cacheService', () => {
  it('getCacheSize should call invoke with correct command', async () => {
    const info = { totalSize: 576716800, fileCount: 100, cacheDir: '/cache' };
    mockInvoke.mockResolvedValueOnce(info);

    const result = await getCacheSize();
    expect(mockInvoke).toHaveBeenCalledWith('get_cache_size');
    expect(result).toEqual(info);
  });

  it('clearCache should call invoke with correct command', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    await clearCache();
    expect(mockInvoke).toHaveBeenCalledWith('clear_cache');
  });
});

describe('formatCacheSize', () => {
  it('should format 0 bytes', () => {
    expect(formatCacheSize(0)).toBe('0 B');
  });

  it('should format KB level', () => {
    expect(formatCacheSize(512000)).toBe('500.0 KB');
  });

  it('should format MB level', () => {
    expect(formatCacheSize(134217728)).toBe('128.0 MB');
  });

  it('should format GB level', () => {
    expect(formatCacheSize(1610612736)).toBe('1.5 GB');
  });
});
