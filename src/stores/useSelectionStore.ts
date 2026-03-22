import { create } from 'zustand';

interface SelectionStoreState {
  // 状态
  selectedHashes: Set<string>;
  selectedCount: number;

  // Actions
  toggleSelection: (hash: string) => void;
  clearSelection: () => void;
  getSelectedInGroup: (groupHashes: string[]) => number;
}

export const useSelectionStore = create<SelectionStoreState>((set, get) => ({
  selectedHashes: new Set<string>(),
  selectedCount: 0,

  toggleSelection: (hash) =>
    set((state) => {
      const newSet = new Set(state.selectedHashes);
      if (newSet.has(hash)) {
        newSet.delete(hash);
      } else {
        newSet.add(hash);
      }
      return { selectedHashes: newSet, selectedCount: newSet.size };
    }),

  clearSelection: () =>
    set({ selectedHashes: new Set<string>(), selectedCount: 0 }),

  getSelectedInGroup: (groupHashes) => {
    const { selectedHashes } = get();
    return groupHashes.filter((h) => selectedHashes.has(h)).length;
  },
}));
