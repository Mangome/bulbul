export interface Province {
  name: string;
  lat: number;
  lng: number;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface RegionGroup {
  label: string;
  provinces: Province[];
}

export const REGION_GROUPS: RegionGroup[] = [
  { label: '华北', provinces: [] },
  { label: '东北', provinces: [] },
  { label: '华东', provinces: [] },
  { label: '华中', provinces: [] },
  { label: '华南', provinces: [] },
  { label: '西南', provinces: [] },
  { label: '西北', provinces: [] },
];

/** 省份→地区映射 */
const PROVINCE_REGION: Record<string, string> = {
  '北京': '华北', '天津': '华北', '河北': '华北', '山西': '华北', '内蒙古': '华北',
  '辽宁': '东北', '吉林': '东北', '黑龙江': '东北',
  '上海': '华东', '江苏': '华东', '浙江': '华东', '安徽': '华东',
  '福建': '华东', '江西': '华东', '山东': '华东',
  '河南': '华中', '湖北': '华中', '湖南': '华中',
  '广东': '华南', '广西': '华南', '海南': '华南',
  '香港': '华南', '澳门': '华南', '台湾': '华南',
  '重庆': '西南', '四川': '西南', '贵州': '西南', '云南': '西南', '西藏': '西南',
  '陕西': '西北', '甘肃': '西北', '青海': '西北', '宁夏': '西北', '新疆': '西北',
};

function buildRegionGroups(): RegionGroup[] {
  const map = new Map<string, Province[]>();
  for (const rg of REGION_GROUPS) {
    map.set(rg.label, []);
  }
  for (const p of PROVINCES) {
    const region = PROVINCE_REGION[p.name];
    if (region) {
      map.get(region)!.push(p);
    }
  }
  return REGION_GROUPS.filter((rg) => map.get(rg.label)!.length > 0)
    .map((rg) => ({ label: rg.label, provinces: map.get(rg.label)! }));
}

export const PROVINCES: Province[] = [
  { name: '北京', lat: 39.9, lng: 116.4, minLat: 39.4, maxLat: 41.1, minLng: 115.4, maxLng: 117.5 },
  { name: '天津', lat: 39.1, lng: 117.2, minLat: 38.6, maxLat: 40.3, minLng: 116.7, maxLng: 118.0 },
  { name: '河北', lat: 38.0, lng: 114.5, minLat: 36.0, maxLat: 42.6, minLng: 113.5, maxLng: 119.8 },
  { name: '山西', lat: 37.9, lng: 112.5, minLat: 34.6, maxLat: 40.7, minLng: 110.1, maxLng: 114.6 },
  { name: '内蒙古', lat: 40.8, lng: 111.7, minLat: 37.4, maxLat: 53.4, minLng: 97.2, maxLng: 126.1 },
  { name: '辽宁', lat: 41.8, lng: 123.4, minLat: 38.7, maxLat: 43.5, minLng: 118.9, maxLng: 125.8 },
  { name: '吉林', lat: 43.9, lng: 125.3, minLat: 40.9, maxLat: 44.1, minLng: 122.0, maxLng: 131.2 },
  { name: '黑龙江', lat: 45.8, lng: 126.5, minLat: 43.4, maxLat: 53.6, minLng: 121.2, maxLng: 135.1 },
  { name: '上海', lat: 31.2, lng: 121.5, minLat: 30.7, maxLat: 31.9, minLng: 120.9, maxLng: 122.0 },
  { name: '江苏', lat: 32.1, lng: 118.8, minLat: 30.7, maxLat: 35.1, minLng: 116.4, maxLng: 121.9 },
  { name: '浙江', lat: 30.3, lng: 120.2, minLat: 27.2, maxLat: 31.2, minLng: 118.0, maxLng: 123.0 },
  { name: '安徽', lat: 31.9, lng: 117.3, minLat: 29.4, maxLat: 34.7, minLng: 114.9, maxLng: 119.7 },
  { name: '福建', lat: 26.1, lng: 119.3, minLat: 23.5, maxLat: 28.3, minLng: 115.8, maxLng: 120.8 },
  { name: '江西', lat: 28.7, lng: 115.9, minLat: 24.5, maxLat: 30.1, minLng: 113.6, maxLng: 118.5 },
  { name: '山东', lat: 36.7, lng: 117.0, minLat: 34.4, maxLat: 38.4, minLng: 114.8, maxLng: 122.7 },
  { name: '河南', lat: 34.8, lng: 113.7, minLat: 31.4, maxLat: 36.4, minLng: 110.4, maxLng: 116.7 },
  { name: '湖北', lat: 30.6, lng: 114.3, minLat: 29.0, maxLat: 33.3, minLng: 108.4, maxLng: 116.1 },
  { name: '湖南', lat: 28.2, lng: 113.0, minLat: 24.6, maxLat: 30.1, minLng: 108.8, maxLng: 114.3 },
  { name: '广东', lat: 23.1, lng: 113.3, minLat: 20.2, maxLat: 25.5, minLng: 109.7, maxLng: 117.3 },
  { name: '广西', lat: 22.8, lng: 108.3, minLat: 20.5, maxLat: 26.4, minLng: 104.5, maxLng: 112.1 },
  { name: '海南', lat: 20.0, lng: 110.3, minLat: 3.9, maxLat: 20.2, minLng: 108.6, maxLng: 117.5 },
  { name: '重庆', lat: 29.6, lng: 106.5, minLat: 28.2, maxLat: 32.2, minLng: 105.3, maxLng: 110.2 },
  { name: '四川', lat: 30.6, lng: 104.1, minLat: 26.0, maxLat: 34.3, minLng: 97.4, maxLng: 108.6 },
  { name: '贵州', lat: 26.6, lng: 106.7, minLat: 24.6, maxLat: 29.2, minLng: 103.6, maxLng: 109.6 },
  { name: '云南', lat: 25.0, lng: 102.7, minLat: 21.1, maxLat: 29.3, minLng: 97.5, maxLng: 106.2 },
  { name: '西藏', lat: 29.6, lng: 91.1, minLat: 26.4, maxLat: 36.5, minLng: 78.4, maxLng: 99.1 },
  { name: '陕西', lat: 34.3, lng: 108.9, minLat: 31.7, maxLat: 39.6, minLng: 105.5, maxLng: 111.3 },
  { name: '甘肃', lat: 36.1, lng: 103.8, minLat: 32.6, maxLat: 42.8, minLng: 92.5, maxLng: 108.7 },
  { name: '青海', lat: 36.6, lng: 101.8, minLat: 31.6, maxLat: 39.2, minLng: 89.5, maxLng: 103.1 },
  { name: '宁夏', lat: 38.5, lng: 106.3, minLat: 35.2, maxLat: 39.6, minLng: 104.3, maxLng: 107.7 },
  { name: '新疆', lat: 43.8, lng: 87.6, minLat: 34.3, maxLat: 49.2, minLng: 73.5, maxLng: 96.4 },
  { name: '香港', lat: 22.3, lng: 114.2, minLat: 22.1, maxLat: 22.6, minLng: 113.8, maxLng: 114.4 },
  { name: '澳门', lat: 22.2, lng: 113.5, minLat: 22.1, maxLat: 22.2, minLng: 113.5, maxLng: 113.6 },
  { name: '台湾', lat: 25.0, lng: 121.5, minLat: 21.9, maxLat: 25.3, minLng: 120.0, maxLng: 122.0 },
];

/** 按地区分组的省份列表（惰性计算） */
let _grouped: RegionGroup[] | null = null;
export function getProvincesGrouped(): RegionGroup[] {
  if (!_grouped) _grouped = buildRegionGroups();
  return _grouped;
}
