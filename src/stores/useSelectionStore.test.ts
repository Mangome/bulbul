import { describe, it, expect, beforeEach } from 'vitest';
import { useSelectionStore } from './useSelectionStore';

describe('useSelectionStore', () => {
  beforeEach(() => {
    // 每个测试前重置 store
    useSelectionStore.setState({
      selectedHashes: new Set<string>(),
      selectedCount: 0,
    });
  });

  // ── toggleSelection ──

  it('toggleSelection 选中一个 hash', () => {
    useSelectionStore.getState().toggleSelection('hash_a');
    const state = useSelectionStore.getState();
    expect(state.selectedHashes.has('hash_a')).toBe(true);
    expect(state.selectedCount).toBe(1);
  });

  it('toggleSelection 取消已选中的 hash', () => {
    useSelectionStore.getState().toggleSelection('hash_a');
    useSelectionStore.getState().toggleSelection('hash_a');
    const state = useSelectionStore.getState();
    expect(state.selectedHashes.has('hash_a')).toBe(false);
    expect(state.selectedCount).toBe(0);
  });

  // ── clearSelection ──

  it('clearSelection 清除所有选中', () => {
    const store = useSelectionStore.getState();
    store.toggleSelection('hash_a');
    store.toggleSelection('hash_b');
    useSelectionStore.getState().clearSelection();
    const state = useSelectionStore.getState();
    expect(state.selectedCount).toBe(0);
    expect(state.selectedHashes.size).toBe(0);
  });

  // ── getSelectedInGroup ──

  it('getSelectedInGroup 返回组内选中数', () => {
    const store = useSelectionStore.getState();
    store.toggleSelection('hash_a');
    store.toggleSelection('hash_c');
    const count = useSelectionStore.getState().getSelectedInGroup(['hash_a', 'hash_b', 'hash_c']);
    expect(count).toBe(2);
  });

  // ── selectAllInGroup ──

  it('selectAllInGroup 全选一组 hash', () => {
    useSelectionStore.getState().selectAllInGroup(['h1', 'h2', 'h3']);
    const state = useSelectionStore.getState();
    expect(state.selectedCount).toBe(3);
    expect(state.selectedHashes.has('h1')).toBe(true);
    expect(state.selectedHashes.has('h2')).toBe(true);
    expect(state.selectedHashes.has('h3')).toBe(true);
  });

  it('selectAllInGroup 幂等性：重复全选不增加计数', () => {
    const store = useSelectionStore.getState();
    store.selectAllInGroup(['h1', 'h2']);
    useSelectionStore.getState().selectAllInGroup(['h1', 'h2']);
    const state = useSelectionStore.getState();
    expect(state.selectedCount).toBe(2);
  });

  it('selectAllInGroup 对已部分选中的组不重复添加', () => {
    useSelectionStore.getState().toggleSelection('h1');
    useSelectionStore.getState().selectAllInGroup(['h1', 'h2', 'h3']);
    const state = useSelectionStore.getState();
    expect(state.selectedCount).toBe(3);
  });

  // ── deselectAllInGroup ──

  it('deselectAllInGroup 取消一组 hash 的选中', () => {
    const store = useSelectionStore.getState();
    store.selectAllInGroup(['h1', 'h2', 'h3', 'h4']);
    useSelectionStore.getState().deselectAllInGroup(['h1', 'h2']);
    const state = useSelectionStore.getState();
    expect(state.selectedCount).toBe(2);
    expect(state.selectedHashes.has('h1')).toBe(false);
    expect(state.selectedHashes.has('h2')).toBe(false);
    expect(state.selectedHashes.has('h3')).toBe(true);
    expect(state.selectedHashes.has('h4')).toBe(true);
  });

  // ── 跨分组选中隔离 ──

  it('selectAllInGroup 不影响其它分组的选中状态', () => {
    const store = useSelectionStore.getState();
    store.toggleSelection('other_group_hash');
    useSelectionStore.getState().selectAllInGroup(['g1_h1', 'g1_h2']);
    const state = useSelectionStore.getState();
    expect(state.selectedCount).toBe(3);
    expect(state.selectedHashes.has('other_group_hash')).toBe(true);
  });

  it('deselectAllInGroup 不影响其它分组的选中状态', () => {
    const store = useSelectionStore.getState();
    store.selectAllInGroup(['g1_h1', 'g1_h2', 'g2_h1']);
    useSelectionStore.getState().deselectAllInGroup(['g1_h1', 'g1_h2']);
    const state = useSelectionStore.getState();
    expect(state.selectedCount).toBe(1);
    expect(state.selectedHashes.has('g2_h1')).toBe(true);
  });
});
