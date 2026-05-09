import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutoUpdateCheck } from './useAutoUpdateCheck';

vi.mock('../services/updaterService', () => ({
  checkForUpdate: vi.fn(),
}));

vi.mock('../stores/useToastStore', () => ({
  useToastStore: {
    getState: vi.fn(),
  },
}));

import { checkForUpdate } from '../services/updaterService';
import { useToastStore } from '../stores/useToastStore';

const mockCheckForUpdate = vi.mocked(checkForUpdate);
const mockGetState = vi.mocked(useToastStore.getState);

describe('useAutoUpdateCheck', () => {
  const onOpenSettings = vi.fn();
  const addToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetState.mockReturnValue({ addToast } as never);
  });

  it('should show toast when update is available', async () => {
    mockCheckForUpdate.mockResolvedValueOnce({
      available: true,
      update: {
        currentVersion: '0.7.3',
        version: '0.7.4',
        notes: '修复若干问题',
        publishedAt: null,
      },
    });

    renderHook(() => useAutoUpdateCheck(onOpenSettings));

    // Wait for async effect
    await vi.waitFor(() => {
      expect(addToast).toHaveBeenCalledTimes(1);
    });

    expect(addToast).toHaveBeenCalledWith({
      type: 'info',
      message: '发现新版本 v0.7.4，点击查看',
      onClick: onOpenSettings,
    });
  });

  it('should be silent when no update is available', async () => {
    mockCheckForUpdate.mockResolvedValueOnce({
      available: false,
      currentVersion: '0.7.3',
    });

    renderHook(() => useAutoUpdateCheck(onOpenSettings));

    await vi.waitFor(() => {
      expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);
    });

    expect(addToast).not.toHaveBeenCalled();
  });

  it('should be silent when check fails', async () => {
    mockCheckForUpdate.mockRejectedValueOnce(new Error('Network error'));

    renderHook(() => useAutoUpdateCheck(onOpenSettings));

    await vi.waitFor(() => {
      expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);
    });

    expect(addToast).not.toHaveBeenCalled();
  });

  it('should not check again on re-render (StrictMode guard)', async () => {
    mockCheckForUpdate.mockResolvedValueOnce({
      available: false,
      currentVersion: '0.7.3',
    });

    const { rerender } = renderHook(() => useAutoUpdateCheck(onOpenSettings));

    await vi.waitFor(() => {
      expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);
    });

    rerender();

    // Should still be 1, not 2
    expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);
  });
});
