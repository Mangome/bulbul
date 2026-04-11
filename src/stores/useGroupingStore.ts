import { create } from 'zustand';

const MIN_SIMILARITY = 50;
const MAX_SIMILARITY = 100;
const MIN_TIME_GAP = 1;
const MAX_TIME_GAP = 120;

interface GroupingStoreState {
  similarityThreshold: number;
  timeGapSeconds: number;
  setSimilarityThreshold: (value: number) => void;
  setTimeGapSeconds: (value: number) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const useGroupingStore = create<GroupingStoreState>((set) => ({
  similarityThreshold: 90.0,
  timeGapSeconds: 10,

  setSimilarityThreshold: (value) =>
    set({ similarityThreshold: clamp(value, MIN_SIMILARITY, MAX_SIMILARITY) }),

  setTimeGapSeconds: (value) =>
    set({ timeGapSeconds: clamp(value, MIN_TIME_GAP, MAX_TIME_GAP) }),
}));
