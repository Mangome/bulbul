import { describe, it, expect, beforeEach } from 'vitest';
import { useSelectionStore } from './useSelectionStore';

describe('useSelectionStore', () => {
  beforeEach(() => {
    useSelectionStore.getState().clearSelection();
  });

  it('should have correct initial state', () => {
    const state = useSelectionStore.getState();
    expect(state.selectedHashes.size).toBe(0);
    expect(state.selectedCount).toBe(0);
  });

  it('should toggle selection on', () => {
    useSelectionStore.getState().toggleSelection('abc123');
    const state = useSelectionStore.getState();
    expect(state.selectedHashes.has('abc123')).toBe(true);
    expect(state.selectedCount).toBe(1);
  });

  it('should toggle selection off', () => {
    useSelectionStore.getState().toggleSelection('abc123');
    useSelectionStore.getState().toggleSelection('abc123');
    const state = useSelectionStore.getState();
    expect(state.selectedHashes.has('abc123')).toBe(false);
    expect(state.selectedCount).toBe(0);
  });

  it('should clear all selections', () => {
    useSelectionStore.getState().toggleSelection('a');
    useSelectionStore.getState().toggleSelection('b');
    useSelectionStore.getState().toggleSelection('c');
    useSelectionStore.getState().toggleSelection('d');
    useSelectionStore.getState().toggleSelection('e');

    expect(useSelectionStore.getState().selectedCount).toBe(5);

    useSelectionStore.getState().clearSelection();
    expect(useSelectionStore.getState().selectedCount).toBe(0);
    expect(useSelectionStore.getState().selectedHashes.size).toBe(0);
  });

  it('should count selected in group', () => {
    useSelectionStore.getState().toggleSelection('a');
    useSelectionStore.getState().toggleSelection('b');

    const count = useSelectionStore.getState().getSelectedInGroup(['a', 'b', 'c']);
    expect(count).toBe(2);
  });

  it('should return 0 when no selections in group', () => {
    useSelectionStore.getState().toggleSelection('x');

    const count = useSelectionStore.getState().getSelectedInGroup(['a', 'b', 'c']);
    expect(count).toBe(0);
  });
});
