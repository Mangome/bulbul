import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getImageUrl, getMetadata, getBatchMetadata } from './imageService';

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${encodeURIComponent(path)}`),
}));

import { invoke, convertFileSrc } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);
const mockConvertFileSrc = vi.mocked(convertFileSrc);

describe('imageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getImageUrl should invoke and convert file src', async () => {
    mockInvoke.mockResolvedValueOnce('/cache/abc_thumb.jpg');

    const result = await getImageUrl('abc', 'thumbnail');

    expect(mockInvoke).toHaveBeenCalledWith('get_image_url', { hash: 'abc', size: 'thumbnail' });
    expect(mockConvertFileSrc).toHaveBeenCalledWith('/cache/abc_thumb.jpg');
    expect(result).toContain('asset://');
  });

  it('getImageUrl should default to thumbnail size', async () => {
    mockInvoke.mockResolvedValueOnce('/cache/abc_thumb.jpg');

    await getImageUrl('abc');

    expect(mockInvoke).toHaveBeenCalledWith('get_image_url', { hash: 'abc', size: 'thumbnail' });
  });

  it('getMetadata should call invoke with correct params', async () => {
    const metadata = { cameraMake: 'Nikon' };
    mockInvoke.mockResolvedValueOnce(metadata);

    const result = await getMetadata('abc');
    expect(mockInvoke).toHaveBeenCalledWith('get_metadata', { hash: 'abc' });
    expect(result).toEqual(metadata);
  });

  it('getBatchMetadata should call invoke with correct params', async () => {
    const metadataList = [{ cameraMake: 'Nikon' }, { cameraMake: 'Canon' }];
    mockInvoke.mockResolvedValueOnce(metadataList);

    const result = await getBatchMetadata(['h1', 'h2']);
    expect(mockInvoke).toHaveBeenCalledWith('get_batch_metadata', { hashes: ['h1', 'h2'] });
    expect(result).toEqual(metadataList);
  });
});
