export interface Region {
  name: string;
  /** 英文别名（小写），用于搜索匹配 */
  aliases?: string[];
  lat: number;
  lng: number;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface RegionGroup {
  label: string;
  regions: Region[];
}

export const REGION_GROUPS: RegionGroup[] = [
  { label: '华北', regions: [] },
  { label: '东北', regions: [] },
  { label: '华东', regions: [] },
  { label: '华中', regions: [] },
  { label: '华南', regions: [] },
  { label: '西南', regions: [] },
  { label: '西北', regions: [] },
  { label: '亚洲', regions: [] },
  { label: '欧洲', regions: [] },
  { label: '北美洲', regions: [] },
  { label: '中南美洲', regions: [] },
  { label: '非洲', regions: [] },
  { label: '大洋洲', regions: [] },
];

/** 地区→分组映射 */
const GROUP_OF: Record<string, string> = {
  '北京': '华北', '天津': '华北', '河北': '华北', '山西': '华北', '内蒙古': '华北',
  '辽宁': '东北', '吉林': '东北', '黑龙江': '东北',
  '上海': '华东', '江苏': '华东', '浙江': '华东', '安徽': '华东',
  '福建': '华东', '江西': '华东', '山东': '华东',
  '河南': '华中', '湖北': '华中', '湖南': '华中',
  '广东': '华南', '广西': '华南', '海南': '华南',
  '香港': '华南', '澳门': '华南', '台湾': '华南',
  '重庆': '西南', '四川': '西南', '贵州': '西南', '云南': '西南', '西藏': '西南',
  '陕西': '西北', '甘肃': '西北', '青海': '西北', '宁夏': '西北', '新疆': '西北',
  '日本': '亚洲', '韩国': '亚洲', '泰国': '亚洲', '越南': '亚洲', '马来西亚': '亚洲',
  '印度尼西亚': '亚洲', '菲律宾': '亚洲', '印度': '亚洲', '尼泊尔': '亚洲', '斯里兰卡': '亚洲',
  '英国': '欧洲', '挪威': '欧洲', '西班牙': '欧洲',
  '美国': '北美洲', '加拿大': '北美洲',
  '哥斯达黎加': '中南美洲', '厄瓜多尔': '中南美洲', '秘鲁': '中南美洲', '巴西': '中南美洲',
  '肯尼亚': '非洲', '坦桑尼亚': '非洲', '南非': '非洲', '马达加斯加': '非洲',
  '澳大利亚': '大洋洲', '新西兰': '大洋洲',
};

function buildRegionGroups(): RegionGroup[] {
  const map = new Map<string, Region[]>();
  for (const rg of REGION_GROUPS) {
    map.set(rg.label, []);
  }
  for (const r of REGIONS) {
    const group = GROUP_OF[r.name];
    if (group) {
      map.get(group)!.push(r);
    }
  }
  return REGION_GROUPS.filter((rg) => map.get(rg.label)!.length > 0)
    .map((rg) => ({ label: rg.label, regions: map.get(rg.label)! }));
}

export const REGIONS: Region[] = [
  // ─── 中国省份 ─────────────────────────────────
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

  // ─── 国外国家 ─────────────────────────────────
  // ponytail: 地理跨度大的国家取主体陆地区域单 bbox:日本含琉球(罩住台湾北部,
  // 物种相近可接受);美国含阿拉斯加但不含夏威夷/阿留申;厄瓜多尔不含加拉帕戈斯。
  // 后端 bbox 查询不支持跨 180° 经线,故不收录俄罗斯。
  { name: '日本', aliases: ['japan'], lat: 36.2, lng: 138.3, minLat: 24.0, maxLat: 46.0, minLng: 123.0, maxLng: 146.0 },
  { name: '韩国', aliases: ['south korea', 'korea'], lat: 36.4, lng: 127.9, minLat: 33.0, maxLat: 39.0, minLng: 125.0, maxLng: 130.0 },
  { name: '泰国', aliases: ['thailand'], lat: 15.9, lng: 101.0, minLat: 5.5, maxLat: 20.5, minLng: 97.3, maxLng: 105.7 },
  { name: '越南', aliases: ['vietnam'], lat: 14.1, lng: 108.3, minLat: 8.2, maxLat: 23.4, minLng: 102.1, maxLng: 109.5 },
  { name: '马来西亚', aliases: ['malaysia'], lat: 4.2, lng: 110.0, minLat: 0.9, maxLat: 7.4, minLng: 99.6, maxLng: 119.6 },
  { name: '印度尼西亚', aliases: ['indonesia'], lat: -2.5, lng: 118.0, minLat: -11.0, maxLat: 6.1, minLng: 94.9, maxLng: 141.0 },
  { name: '菲律宾', aliases: ['philippines'], lat: 12.9, lng: 121.8, minLat: 4.6, maxLat: 21.1, minLng: 116.9, maxLng: 126.6 },
  { name: '印度', aliases: ['india'], lat: 22.0, lng: 79.0, minLat: 6.6, maxLat: 35.5, minLng: 68.2, maxLng: 97.4 },
  { name: '尼泊尔', aliases: ['nepal'], lat: 28.4, lng: 84.1, minLat: 26.3, maxLat: 30.5, minLng: 80.1, maxLng: 88.2 },
  { name: '斯里兰卡', aliases: ['sri lanka'], lat: 7.9, lng: 80.8, minLat: 5.9, maxLat: 9.9, minLng: 79.7, maxLng: 81.9 },
  { name: '英国', aliases: ['united kingdom', 'uk', 'britain'], lat: 54.0, lng: -2.5, minLat: 49.9, maxLat: 60.9, minLng: -8.2, maxLng: 1.8 },
  { name: '挪威', aliases: ['norway'], lat: 65.0, lng: 12.0, minLat: 57.9, maxLat: 71.2, minLng: 4.5, maxLng: 31.2 },
  { name: '西班牙', aliases: ['spain'], lat: 40.2, lng: -3.6, minLat: 36.0, maxLat: 43.8, minLng: -9.3, maxLng: 3.3 },
  { name: '美国', aliases: ['united states', 'usa', 'america'], lat: 39.8, lng: -98.6, minLat: 24.5, maxLat: 71.4, minLng: -170.0, maxLng: -66.9 },
  { name: '加拿大', aliases: ['canada'], lat: 56.1, lng: -106.3, minLat: 41.7, maxLat: 83.1, minLng: -141.0, maxLng: -52.6 },
  { name: '哥斯达黎加', aliases: ['costa rica'], lat: 9.7, lng: -84.0, minLat: 8.0, maxLat: 11.2, minLng: -85.9, maxLng: -82.5 },
  { name: '厄瓜多尔', aliases: ['ecuador'], lat: -1.8, lng: -78.2, minLat: -5.0, maxLat: 1.5, minLng: -81.1, maxLng: -75.2 },
  { name: '秘鲁', aliases: ['peru'], lat: -9.2, lng: -75.0, minLat: -18.4, maxLat: -0.1, minLng: -81.3, maxLng: -68.7 },
  { name: '巴西', aliases: ['brazil'], lat: -14.2, lng: -51.9, minLat: -33.8, maxLat: 5.3, minLng: -73.9, maxLng: -34.8 },
  { name: '肯尼亚', aliases: ['kenya'], lat: 0.2, lng: 37.9, minLat: -4.7, maxLat: 5.5, minLng: 33.9, maxLng: 41.9 },
  { name: '坦桑尼亚', aliases: ['tanzania'], lat: -6.4, lng: 34.9, minLat: -11.8, maxLat: -1.0, minLng: 29.3, maxLng: 40.4 },
  { name: '南非', aliases: ['south africa'], lat: -29.0, lng: 25.0, minLat: -34.8, maxLat: -22.1, minLng: 16.5, maxLng: 32.9 },
  { name: '马达加斯加', aliases: ['madagascar'], lat: -19.0, lng: 47.0, minLat: -25.6, maxLat: -11.9, minLng: 43.2, maxLng: 50.5 },
  { name: '澳大利亚', aliases: ['australia'], lat: -25.3, lng: 133.8, minLat: -43.7, maxLat: -10.7, minLng: 113.2, maxLng: 153.6 },
  { name: '新西兰', aliases: ['new zealand'], lat: -41.8, lng: 172.8, minLat: -47.3, maxLat: -34.4, minLng: 166.4, maxLng: 178.6 },
];

/** 按大区分组的地区列表（惰性计算） */
let _grouped: RegionGroup[] | null = null;
export function getRegionsGrouped(): RegionGroup[] {
  if (!_grouped) _grouped = buildRegionGroups();
  return _grouped;
}
