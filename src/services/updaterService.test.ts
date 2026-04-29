import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkForUpdate, downloadAndInstallUpdate, getCurrentVersion } from './updaterService';

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}));

import { getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';

const mockGetVersion = vi.mocked(getVersion);
const mockRelaunch = vi.mocked(relaunch);
const mockCheck = vi.mocked(check);

function createMockUpdate(overrides?: Partial<{
  version: string;
  body?: string;
  date?: string;
  downloadAndInstall: (callback?: (event: unknown) => void) => Promise<void>;
  close: () => Promise<void>;
}>) {
  return {
    version: '0.7.4',
    body: '修复若干问题',
    date: '2026-04-30T00:00:00Z',
    downloadAndInstall: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('updaterService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetVersion.mockResolvedValueOnce('0.7.3');
    mockCheck.mockResolvedValueOnce(null);
    await checkForUpdate();
    vi.clearAllMocks();
  });

  it('getCurrentVersion should return app version', async () => {
    mockGetVersion.mockResolvedValueOnce('0.7.3');

    await expect(getCurrentVersion()).resolves.toBe('0.7.3');
  });

  it('checkForUpdate should return no-update result', async () => {
    mockGetVersion.mockResolvedValueOnce('0.7.3');
    mockCheck.mockResolvedValueOnce(null);

    await expect(checkForUpdate()).resolves.toEqual({
      available: false,
      currentVersion: '0.7.3',
    });
  });

  it('checkForUpdate should return update metadata', async () => {
    const update = createMockUpdate();
    mockGetVersion.mockResolvedValueOnce('0.7.3');
    mockCheck.mockResolvedValueOnce(update as never);

    await expect(checkForUpdate()).resolves.toEqual({
      available: true,
      update: {
        currentVersion: '0.7.3',
        version: '0.7.4',
        notes: '修复若干问题',
        publishedAt: '2026-04-30T00:00:00Z',
      },
    });
  });

  it('checkForUpdate should dispose previous pending update before replacing it', async () => {
    const firstUpdate = createMockUpdate({ version: '0.7.4' });
    const secondUpdate = createMockUpdate({ version: '0.7.5' });

    mockGetVersion.mockResolvedValue('0.7.3');
    mockCheck
      .mockResolvedValueOnce(firstUpdate as never)
      .mockResolvedValueOnce(secondUpdate as never);

    await checkForUpdate();
    await checkForUpdate();

    expect(firstUpdate.close).toHaveBeenCalledTimes(1);
    expect(secondUpdate.close).not.toHaveBeenCalled();
  });

  it('downloadAndInstallUpdate should require a pending update', async () => {
    await expect(downloadAndInstallUpdate()).rejects.toThrow('当前没有可安装的更新，请先检查更新。');
  });

  it('downloadAndInstallUpdate should forward progress and relaunch app', async () => {
    const update = createMockUpdate({
      downloadAndInstall: vi.fn().mockImplementation(async (callback?: (event: unknown) => void) => {
        callback?.({ event: 'Started', data: { contentLength: 100 } });
        callback?.({ event: 'Progress', data: { chunkLength: 40 } });
        callback?.({ event: 'Progress', data: { chunkLength: 60 } });
        callback?.({ event: 'Finished' });
      }),
    });

    mockGetVersion.mockResolvedValueOnce('0.7.3');
    mockCheck.mockResolvedValueOnce(update as never);
    mockRelaunch.mockResolvedValueOnce(undefined);

    await checkForUpdate();

    const progress = vi.fn();
    await downloadAndInstallUpdate(progress);

    expect(update.downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenNthCalledWith(1, {
      stage: 'downloading',
      downloadedBytes: 0,
      totalBytes: 100,
    });
    expect(progress).toHaveBeenNthCalledWith(2, {
      stage: 'downloading',
      downloadedBytes: 40,
      totalBytes: 100,
    });
    expect(progress).toHaveBeenNthCalledWith(3, {
      stage: 'downloading',
      downloadedBytes: 100,
      totalBytes: 100,
    });
    expect(progress).toHaveBeenNthCalledWith(4, {
      stage: 'installing',
      downloadedBytes: 100,
      totalBytes: 100,
    });
    expect(mockRelaunch).toHaveBeenCalledTimes(1);
    expect(update.close).toHaveBeenCalledTimes(1);
  });
});
