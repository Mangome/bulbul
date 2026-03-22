import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './useAppStore';
import type { FolderInfo, GroupData } from '../types';

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.getState().reset();
  });

  it('should have correct initial state', () => {
    const state = useAppStore.getState();
    expect(state.currentFolder).toBeNull();
    expect(state.folderInfo).toBeNull();
    expect(state.groups).toEqual([]);
    expect(state.totalImages).toBe(0);
    expect(state.selectedGroupId).toBeNull();
    expect(state.processingState).toBe('idle');
    expect(state.progress).toBeNull();
  });

  it('should set folder', () => {
    const folderInfo: FolderInfo = {
      path: '/path/to/folder',
      name: 'folder',
      fileCount: 10,
      rawCount: 5,
    };

    useAppStore.getState().setFolder('/path/to/folder', folderInfo);

    const state = useAppStore.getState();
    expect(state.currentFolder).toBe('/path/to/folder');
    expect(state.folderInfo).toEqual(folderInfo);
  });

  it('should set groups', () => {
    const groups: GroupData[] = [
      {
        id: 0,
        name: 'Group 0',
        imageCount: 3,
        avgSimilarity: 0.9,
        representativeHash: 'h0',
        pictureHashes: ['h1', 'h2', 'h3'],
        pictureNames: ['a.nef', 'b.nef', 'c.nef'],
        picturePaths: ['/a.nef', '/b.nef', '/c.nef'],
      },
    ];

    useAppStore.getState().setGroups(groups, 3);

    const state = useAppStore.getState();
    expect(state.groups).toEqual(groups);
    expect(state.totalImages).toBe(3);
  });

  it('should navigate groups cyclically', () => {
    const groups: GroupData[] = [
      { id: 0, name: 'G0', imageCount: 1, avgSimilarity: 0.9, representativeHash: 'h0', pictureHashes: [], pictureNames: [], picturePaths: [] },
      { id: 1, name: 'G1', imageCount: 1, avgSimilarity: 0.9, representativeHash: 'h1', pictureHashes: [], pictureNames: [], picturePaths: [] },
      { id: 2, name: 'G2', imageCount: 1, avgSimilarity: 0.9, representativeHash: 'h2', pictureHashes: [], pictureNames: [], picturePaths: [] },
    ];

    useAppStore.getState().setGroups(groups, 3);
    useAppStore.getState().selectGroup(2);

    // 最后一个 → next → 回到第一个
    useAppStore.getState().navigateGroup('next');
    expect(useAppStore.getState().selectedGroupId).toBe(0);

    // 第一个 → prev → 到最后一个
    useAppStore.getState().navigateGroup('prev');
    expect(useAppStore.getState().selectedGroupId).toBe(2);
  });

  it('should reset to initial state', () => {
    const folderInfo: FolderInfo = {
      path: '/path',
      name: 'test',
      fileCount: 5,
      rawCount: 3,
    };

    useAppStore.getState().setFolder('/path', folderInfo);
    useAppStore.getState().setProcessingState('processing');
    useAppStore.getState().reset();

    const state = useAppStore.getState();
    expect(state.currentFolder).toBeNull();
    expect(state.processingState).toBe('idle');
  });
});
