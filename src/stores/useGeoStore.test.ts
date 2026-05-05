import { describe, it, expect, beforeEach } from 'vitest';
import { useGeoStore } from './useGeoStore';

describe('useGeoStore', () => {
  beforeEach(() => {
    useGeoStore.setState({ selectedProvince: null });
  });

  it('初始 selectedProvince 应为 null', () => {
    const { selectedProvince } = useGeoStore.getState();
    expect(selectedProvince).toBeNull();
  });

  it('setProvince 应设置选中的省份', () => {
    const beijing = { name: '北京', lat: 39.9, lng: 116.4, minLat: 39.4, maxLat: 41.1, minLng: 115.4, maxLng: 117.5 };
    useGeoStore.getState().setProvince(beijing);
    expect(useGeoStore.getState().selectedProvince).toEqual(beijing);
  });

  it('setProvince(null) 应清除选中', () => {
    const yunnan = { name: '云南', lat: 25.0, lng: 102.7, minLat: 21.1, maxLat: 29.3, minLng: 97.5, maxLng: 106.2 };
    useGeoStore.getState().setProvince(yunnan);
    expect(useGeoStore.getState().selectedProvince).toEqual(yunnan);

    useGeoStore.getState().setProvince(null);
    expect(useGeoStore.getState().selectedProvince).toBeNull();
  });

  it('setProvince 切换省份应覆盖之前的选择', () => {
    const beijing = { name: '北京', lat: 39.9, lng: 116.4, minLat: 39.4, maxLat: 41.1, minLng: 115.4, maxLng: 117.5 };
    const yunnan = { name: '云南', lat: 25.0, lng: 102.7, minLat: 21.1, maxLat: 29.3, minLng: 97.5, maxLng: 106.2 };

    useGeoStore.getState().setProvince(beijing);
    expect(useGeoStore.getState().selectedProvince?.name).toBe('北京');

    useGeoStore.getState().setProvince(yunnan);
    expect(useGeoStore.getState().selectedProvince?.name).toBe('云南');
  });

  it('selectedProvince 应包含完整的省份数据', () => {
    const guangdong = { name: '广东', lat: 23.1, lng: 113.3, minLat: 20.2, maxLat: 25.5, minLng: 109.7, maxLng: 117.3 };
    useGeoStore.getState().setProvince(guangdong);
    const province = useGeoStore.getState().selectedProvince;

    expect(province).not.toBeNull();
    expect(province!.name).toBe('广东');
    expect(province!.lat).toBeCloseTo(23.1);
    expect(province!.lng).toBeCloseTo(113.3);
    expect(province!.minLat).toBeCloseTo(20.2);
    expect(province!.maxLat).toBeCloseTo(25.5);
  });
});
