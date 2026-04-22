import { create } from 'zustand';
import type { Province } from '../data/provinces';

interface GeoState {
  selectedProvince: Province | null;
  setProvince: (province: Province | null) => void;
}

export const useGeoStore = create<GeoState>((set) => ({
  selectedProvince: null,
  setProvince: (province) => set({ selectedProvince: province }),
}));
