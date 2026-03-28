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

const mockGroup2: GroupData = {
  ...mockGroup,
  id: 2,
  name: '分组2',
  pictureHashes: ['h4', 'h5'],
  pictureNames: ['d.nef', 'e.nef'],
  picturePaths: ['/d.nef', '/e.nef'],
  imageCount: 2,
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
      groups: [mockGroup, mockGroup2],
      selectedGroupId: 1,
      processingState: 'completed',
    });
    useSelectionStore.setState({
      selectedHashes: new Set<string>(),
      selectedCount: 0,
    });
    useCanvasStore.setState({
      zoomLevel: 1.0,
      currentGroupIndex: 0,
      groupCount: 2,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mount() {
    return renderHook(() =>
      useKeyboard({ onOpenFolder, onExport, onGroupNavigated }),
    );
  }

  it('ArrowRight 触发 nextGroup 和 navigateGroup("next")', () => {
    mount();
    fireKey('ArrowRight');
    expect(useCanvasStore.getState().currentGroupIndex).toBe(1);
    expect(useAppStore.getState().selectedGroupId).toBe(2);
    expect(onGroupNavigated).toHaveBeenCalledOnce();
  });

  it('ArrowLeft 触发 prevGroup 和 navigateGroup("prev")', () => {
    useCanvasStore.setState({ currentGroupIndex: 1 });
    useAppStore.setState({ selectedGroupId: 2 });
    mount();
    fireKey('ArrowLeft');
    expect(useCanvasStore.getState().currentGroupIndex).toBe(0);
    expect(useAppStore.getState().selectedGroupId).toBe(1);
  });

  it('D 键触发 nextGroup', () => {
    mount();
    fireKey('d');
    expect(useCanvasStore.getState().currentGroupIndex).toBe(1);
    expect(onGroupNavigated).toHaveBeenCalledOnce();
  });

  it('A 键触发 prevGroup', () => {
    useCanvasStore.setState({ currentGroupIndex: 1 });
    mount();
    fireKey('a');
    expect(useCanvasStore.getState().currentGroupIndex).toBe(0);
  });

  it('W/S 键不再触发分组导航', () => {
    mount();
    fireKey('s');
    // 分组不应改变
    expect(useCanvasStore.getState().currentGroupIndex).toBe(0);
    expect(onGroupNavigated).not.toHaveBeenCalled();
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

  it('Ctrl+A 全选当前分组 (基于 currentGroupIndex)', () => {
    useCanvasStore.setState({ currentGroupIndex: 0 });
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
    fireKey('ArrowRight');
    expect(useCanvasStore.getState().currentGroupIndex).toBe(0);
    document.body.removeChild(input);
  });
});
