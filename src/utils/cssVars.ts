// ============================================================
// CSS 变量读取工具
//
// Canvas 2D 无法直接使用 CSS 变量，通过此工具在运行时
// 读取 CSS 自定义属性值，确保画布绘制颜色与设计系统同步。
// ============================================================

/**
 * 读取根元素上的 CSS 自定义属性值
 * @param name 变量名（含 -- 前缀）
 * @returns 变量值的字符串表示，读取失败时返回空字符串
 */
export function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * 读取 CSS 自定义属性值并解析为 RGB 分量数组
 * 适用于 --color-xxx-rgb 格式的变量（值为 "R, G, B"）
 *
 * @param name 变量名（含 -- 前缀）
 * @returns [R, G, B] 数组，解析失败时返回 [0, 0, 0]
 */
export function getCssVarRgb(name: string): [number, number, number] {
  const raw = getCssVar(name);
  if (!raw) return [0, 0, 0];
  const parts = raw.split(',').map((s) => parseInt(s.trim(), 10));
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
    return parts as [number, number, number];
  }
  return [0, 0, 0];
}
