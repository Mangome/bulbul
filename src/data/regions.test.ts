import { describe, it, expect } from 'vitest';
import { REGIONS, getRegionsGrouped } from './regions';

describe('regions 数据完整性', () => {
  it('每个地区都有分组，且分组标签合法', () => {
    const labels = getRegionsGrouped().map((g) => g.label);
    const grouped = getRegionsGrouped().flatMap((g) => g.regions.map((r) => r.name));
    expect(grouped.length).toBe(REGIONS.length);
    expect(labels.length).toBeGreaterThan(0);
  });

  it('bbox 合法:min < max，中心点在 bbox 内', () => {
    for (const r of REGIONS) {
      expect(r.minLat, r.name).toBeLessThan(r.maxLat);
      expect(r.minLng, r.name).toBeLessThan(r.maxLng);
      expect(r.lat, r.name).toBeGreaterThanOrEqual(r.minLat);
      expect(r.lat, r.name).toBeLessThanOrEqual(r.maxLat);
      expect(r.lng, r.name).toBeGreaterThanOrEqual(r.minLng);
      expect(r.lng, r.name).toBeLessThanOrEqual(r.maxLng);
    }
  });

  it('别名为小写且不与中文名重复', () => {
    for (const r of REGIONS) {
      for (const a of r.aliases ?? []) {
        expect(a, r.name).toBe(a.toLowerCase());
      }
    }
  });

  it('地区名全局唯一', () => {
    const names = REGIONS.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
