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
    const beijing = { name: '北京', lat: 39.9, lng: 116.4 };
    useGeoStore.getState().setProvince(beijing);
    expect(useGeoStore.getState().selectedProvince).toEqual(beijing);
  });

  it('setProvince(null) 应清除选中', () => {
    const yunnan = { name: '云南', lat: 25.0, lng: 102.7 };
    useGeoStore.getState().setProvince(yunnan);
    expect(useGeoStore.getState().selectedProvince).toEqual(yunnan);

    useGeoStore.getState().setProvince(null);
    expect(useGeoStore.getState().selectedProvince).toBeNull();
  });

  it('setProvince 切换省份应覆盖之前的选择', () => {
    const beijing = { name: '北京', lat: 39.9, lng: 116.4 };
    const yunnan = { name: '云南', lat: 25.0, lng: 102.7 };

    useGeoStore.getState().setProvince(beijing);
    expect(useGeoStore.getState().selectedProvince?.name).toBe('北京');

    useGeoStore.getState().setProvince(yunnan);
    expect(useGeoStore.getState().selectedProvince?.name).toBe('云南');
  });

  it('selectedProvince 应包含完整的省份数据', () => {
    const guangdong = { name: '广东', lat: 23.1, lng: 113.3 };
    useGeoStore.getState().setProvince(guangdong);
    const province = useGeoStore.getState().selectedProvince;

    expect(province).not.toBeNull();
    expect(province!.name).toBe('广东');
    expect(province!.lat).toBeCloseTo(23.1);
    expect(province!.lng).toBeCloseTo(113.3);
  });
});
