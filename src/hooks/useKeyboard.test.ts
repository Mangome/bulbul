import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboard } from './useKeyboard';
import { useAppStore } from '../stores/useAppStore';
import { useSelectionStore } from '../stores/useSelectionStore';
import { useCanvasStore } from '../stores/useCanvasStore';
import type { GroupData } from '../types';

const mockGroup: GroupData = {
  id: 1,
  name: '分组1',
  imageCount: 3,
  avgSimilarity: 0.9,
  representativeHash: 'h1',
  pictureHashes: ['h1', 'h2', 'h3'],
  pictureNames: ['a.nef', 'b.nef', 'c.nef'],
  picturePaths: ['/a.nef', '/b.nef', '/c.nef'],
};

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }));
}

describe('useKeyboard', () => {
  const onOpenFolder = vi.fn();
  const onExport = vi.fn();
  const onGroupNavigated = vi.fn();

  beforeEach(() => {
    onOpenFolder.mockClear();
    onExport.mockClear();
    onGroupNavigated.mockClear();

    useAppStore.setState({
      groups: [mockGroup, { ...mockGroup, id: 2, name: '分组2' }],
      selectedGroupId: 1,
      processingState: 'completed',
    });
    useSelectionStore.setState({
      selectedHashes: new Set<string>(),
      selectedCount: 0,
    });
    useCanvasStore.setState({ zoomLevel: 1.0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mount() {
    return renderHook(() =>
      useKeyboard({ onOpenFolder, onExport, onGroupNavigated }),
    );
  }

  it('S 键触发 navigateGroup("next")', () => {
    mount();
    fireKey('s');
    expect(useAppStore.getState().selectedGroupId).toBe(2);
    expect(onGroupNavigated).toHaveBeenCalledOnce();
  });

  it('W 键触发 navigateGroup("prev")', () => {
    useAppStore.setState({ selectedGroupId: 2 });
    mount();
    fireKey('w');
    expect(useAppStore.getState().selectedGroupId).toBe(1);
  });

  it('Ctrl+O 触发 onOpenFolder', () => {
    mount();
    fireKey('o', { ctrlKey: true });
    expect(onOpenFolder).toHaveBeenCalledOnce();
  });

  it('Ctrl+E 触发 onExport', () => {
    mount();
    fireKey('e', { ctrlKey: true });
    expect(onExport).toHaveBeenCalledOnce();
  });

  it('Ctrl+A 全选当前分组', () => {
    mount();
    fireKey('a', { ctrlKey: true });
    const state = useSelectionStore.getState();
    expect(state.selectedCount).toBe(3);
    expect(state.selectedHashes.has('h1')).toBe(true);
  });

  it('Ctrl+= 放大', () => {
    mount();
    fireKey('=', { ctrlKey: true });
    expect(useCanvasStore.getState().zoomLevel).toBeCloseTo(1.1, 1);
  });

  it('Ctrl+- 缩小', () => {
    mount();
    fireKey('-', { ctrlKey: true });
    expect(useCanvasStore.getState().zoomLevel).toBeCloseTo(0.9, 1);
  });

  it('Escape 有选中时清除选择', () => {
    useSelectionStore.setState({
      selectedHashes: new Set(['h1']),
      selectedCount: 1,
    });
    mount();
    fireKey('Escape');
    expect(useSelectionStore.getState().selectedCount).toBe(0);
  });

  it('输入框聚焦时不触发快捷键', () => {
    mount();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    fireKey('s');
    // selectedGroupId 不应改变
    expect(useAppStore.getState().selectedGroupId).toBe(1);
    document.body.removeChild(input);
  });
});
