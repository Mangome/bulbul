// ============================================================
// 动画缓动函数库
//
// 统一的缓动函数 + 颜色插值，Canvas rAF 补间与 DOM 过渡共用。
// 遵循项目动画方向：自然减速（ease-out），禁用 bounce/elastic。
// ============================================================

/**
 * easeOutQuart — 自然减速，工具感（推荐作为主曲线）
 * cubic-bezier(0.25, 1, 0.5, 1) 的近似
 */
export function easeOutQuart(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - clamped, 4);
}

/**
 * easeOutQuint — 略偏沉稳，适合长距离过渡（列表滚动、进度条）
 * cubic-bezier(0.22, 1, 0.36, 1) 的近似
 */
export function easeOutQuint(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - clamped, 5);
}

/**
 * easeOutExpo — 最陡峭的减速，决断感（用于点击反馈）
 * cubic-bezier(0.16, 1, 0.3, 1) 的近似
 */
export function easeOutExpo(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped >= 1 ? 1 : 1 - Math.pow(2, -10 * clamped);
}

/**
 * 线性插值
 */
export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * 十六进制颜色解析为 [r, g, b] (0-255)
 */
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3
    ? h.split('').map((c) => c + c).join('')
    : h;
  const num = parseInt(full, 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

/**
 * [r, g, b] (0-255) 转回 CSS 十六进制
 */
function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * RGB 插值（线性空间近似，足够用于主题背景过渡）
 * 对于颜色差异大的过渡，线性 RGB 插值中间会经过"脏灰色"，
 * 但主题切换只在 #FFFFFF ↔ #0F0F0F 等明度单调变化上使用，无此问题。
 */
export function lerpRgbHex(fromHex: string, toHex2: string, t: number): string {
  const [r1, g1, b1] = parseHex(fromHex);
  const [r2, g2, b2] = parseHex(toHex2);
  return toHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t));
}

/**
 * 数字颜色插值（0xRRGGBB），用于 Canvas clearColor 等场景
 */
export function lerpColorNum(from: number, to: number, t: number): number {
  const r1 = (from >> 16) & 0xff;
  const g1 = (from >> 8) & 0xff;
  const b1 = from & 0xff;
  const r2 = (to >> 16) & 0xff;
  const g2 = (to >> 8) & 0xff;
  const b2 = to & 0xff;
  const r = Math.round(lerp(r1, r2, t));
  const g = Math.round(lerp(g1, g2, t));
  const b = Math.round(lerp(b1, b2, t));
  return (r << 16) | (g << 8) | b;
}

/**
 * 检测用户是否开启了 prefers-reduced-motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
