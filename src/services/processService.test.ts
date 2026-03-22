import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processFolder, cancelProcessing, onProgress, onCompleted, onFailed } from './processService';

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock @tauri-apps/api/event
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);

describe('processService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processFolder should use default params when options not provided', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await processFolder('/path');

    expect(mockInvoke).toHaveBeenCalledWith('process_folder', {
      folderPath: '/path',
      similarityThreshold: 90.0,
      timeGapSeconds: 10,
    });
  });

  it('processFolder should use custom params when provided', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await processFolder('/path', { similarityThreshold: 85.0, timeGapSeconds: 15 });

    expect(mockInvoke).toHaveBeenCalledWith('process_folder', {
      folderPath: '/path',
      similarityThreshold: 85.0,
      timeGapSeconds: 15,
    });
  });

  it('cancelProcessing should call invoke', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await cancelProcessing();
    expect(mockInvoke).toHaveBeenCalledWith('cancel_processing');
  });

  it('onProgress should listen to processing-progress event', async () => {
    const unlisten = vi.fn();
    mockListen.mockResolvedValueOnce(unlisten);

    const callback = vi.fn();
    await onProgress(callback);

    expect(mockListen).toHaveBeenCalledWith('processing-progress', expect.any(Function));
  });

  it('onCompleted should listen to processing-completed event', async () => {
    const unlisten = vi.fn();
    mockListen.mockResolvedValueOnce(unlisten);

    const callback = vi.fn();
    await onCompleted(callback);

    expect(mockListen).toHaveBeenCalledWith('processing-completed', expect.any(Function));
  });

  it('onFailed should listen to processing-failed event', async () => {
    const unlisten = vi.fn();
    mockListen.mockResolvedValueOnce(unlisten);

    const callback = vi.fn();
    await onFailed(callback);

    expect(mockListen).toHaveBeenCalledWith('processing-failed', expect.any(Function));
  });
});
