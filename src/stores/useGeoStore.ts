import { create } from 'zustand';
import type { Region } from '../data/regions';

interface GeoState {
  selectedRegion: Region | null;
  setRegion: (region: Region | null) => void;
}

export const useGeoStore = create<GeoState>((set) => ({
  selectedRegion: null,
  setRegion: (region) => set({ selectedRegion: region }),
}));
