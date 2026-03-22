import { create } from 'zustand';
import type {
  FolderInfo,
  GroupData,
  ProcessingState,
  ProcessingProgress,
} from '../types';

interface AppStoreState {
  // 状态
  currentFolder: string | null;
  folderInfo: FolderInfo | null;
  groups: GroupData[];
  totalImages: number;
  selectedGroupId: number | null;
  processingState: ProcessingState;
  progress: ProcessingProgress | null;

  // Actions
  setFolder: (path: string, folderInfo: FolderInfo) => void;
  setGroups: (groups: GroupData[], totalImages: number) => void;
  selectGroup: (groupId: number | null) => void;
  navigateGroup: (direction: 'prev' | 'next') => void;
  setProcessingState: (state: ProcessingState) => void;
  updateProgress: (progress: ProcessingProgress) => void;
  reset: () => void;
}

const initialState = {
  currentFolder: null as string | null,
  folderInfo: null as FolderInfo | null,
  groups: [] as GroupData[],
  totalImages: 0,
  selectedGroupId: null as number | null,
  processingState: 'idle' as ProcessingState,
  progress: null as ProcessingProgress | null,
};

export const useAppStore = create<AppStoreState>((set, get) => ({
  ...initialState,

  setFolder: (path, folderInfo) =>
    set({ currentFolder: path, folderInfo }),

  setGroups: (groups, totalImages) =>
    set({ groups, totalImages }),

  selectGroup: (groupId) =>
    set({ selectedGroupId: groupId }),

  navigateGroup: (direction) => {
    const { groups, selectedGroupId } = get();
    if (groups.length === 0) return;

    const currentIndex = selectedGroupId !== null
      ? groups.findIndex((g) => g.id === selectedGroupId)
      : -1;

    let nextIndex: number;
    if (direction === 'next') {
      nextIndex = currentIndex >= groups.length - 1 ? 0 : currentIndex + 1;
    } else {
      nextIndex = currentIndex <= 0 ? groups.length - 1 : currentIndex - 1;
    }

    set({ selectedGroupId: groups[nextIndex].id });
  },

  setProcessingState: (state) =>
    set({ processingState: state }),

  updateProgress: (progress) =>
    set({ progress }),

  reset: () =>
    set({ ...initialState }),
}));
