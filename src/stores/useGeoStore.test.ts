import { describe, it, expect, beforeEach } from 'vitest';
import { useGeoStore } from './useGeoStore';

describe('useGeoStore', () => {
  beforeEach(() => {
    useGeoStore.setState({ selectedRegion: null });
  });

  it('初始 selectedRegion 应为 null', () => {
    const { selectedRegion } = useGeoStore.getState();
    expect(selectedRegion).toBeNull();
  });

  it('setRegion 应设置选中的地区', () => {
    const beijing = { name: '北京', lat: 39.9, lng: 116.4, minLat: 39.4, maxLat: 41.1, minLng: 115.4, maxLng: 117.5 };
    useGeoStore.getState().setRegion(beijing);
    expect(useGeoStore.getState().selectedRegion).toEqual(beijing);
  });

  it('setRegion(null) 应清除选中', () => {
    const yunnan = { name: '云南', lat: 25.0, lng: 102.7, minLat: 21.1, maxLat: 29.3, minLng: 97.5, maxLng: 106.2 };
    useGeoStore.getState().setRegion(yunnan);
    expect(useGeoStore.getState().selectedRegion).toEqual(yunnan);

    useGeoStore.getState().setRegion(null);
    expect(useGeoStore.getState().selectedRegion).toBeNull();
  });

  it('setRegion 切换地区应覆盖之前的选择', () => {
    const beijing = { name: '北京', lat: 39.9, lng: 116.4, minLat: 39.4, maxLat: 41.1, minLng: 115.4, maxLng: 117.5 };
    const japan = { name: '日本', aliases: ['japan'], lat: 36.2, lng: 138.3, minLat: 24.0, maxLat: 46.0, minLng: 123.0, maxLng: 146.0 };

    useGeoStore.getState().setRegion(beijing);
    expect(useGeoStore.getState().selectedRegion?.name).toBe('北京');

    useGeoStore.getState().setRegion(japan);
    expect(useGeoStore.getState().selectedRegion?.name).toBe('日本');
  });

  it('selectedRegion 应包含完整的地区数据', () => {
    const guangdong = { name: '广东', lat: 23.1, lng: 113.3, minLat: 20.2, maxLat: 25.5, minLng: 109.7, maxLng: 117.3 };
    useGeoStore.getState().setRegion(guangdong);
    const region = useGeoStore.getState().selectedRegion;

    expect(region).not.toBeNull();
    expect(region!.name).toBe('广东');
    expect(region!.lat).toBeCloseTo(23.1);
    expect(region!.lng).toBeCloseTo(113.3);
    expect(region!.minLat).toBeCloseTo(20.2);
    expect(region!.maxLat).toBeCloseTo(25.5);
  });
});
