/**
 * 检测框坐标映射工具
 *
 * 将相对坐标 [0, 1] 映射到像素坐标
 */

/**
 * 坐标映射：从相对坐标到像素坐标
 *
 * @param relCoord 相对坐标 [0, 1]
 * @param displaySize 显示尺寸（像素）
 * @returns 像素坐标
 */
export function relativeToPixelCoord(
  relCoord: number,
  displaySize: number,
): number {
  return relCoord * displaySize;
}

/**
 * 映射检测框：从相对坐标到像素坐标
 *
 * @param x1 左上角 X（相对 [0, 1]）
 * @param y1 左上角 Y
 * @param x2 右下角 X
 * @param y2 右下角 Y
 * @param displayWidth 显示宽度（像素）
 * @param displayHeight 显示高度（像素）
 * @returns { pixelX1, pixelY1, pixelX2, pixelY2 }
 */
export function mapBboxToPixels(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  displayWidth: number,
  displayHeight: number,
): { pixelX1: number; pixelY1: number; pixelX2: number; pixelY2: number } {
  return {
    pixelX1: relativeToPixelCoord(x1, displayWidth),
    pixelY1: relativeToPixelCoord(y1, displayHeight),
    pixelX2: relativeToPixelCoord(x2, displayWidth),
    pixelY2: relativeToPixelCoord(y2, displayHeight),
  };
}

/**
 * 验证坐标是否有效（不超出显示范围）
 *
 * @param pixelX1 像素 X1
 * @param pixelY1 像素 Y1
 * @param pixelX2 像素 X2
 * @param pixelY2 像素 Y2
 * @param displayWidth 显示宽度
 * @param displayHeight 显示高度
 * @returns 是否有效（至少有部分在显示范围内）
 */
export function isValidPixelBbox(
  pixelX1: number,
  pixelY1: number,
  pixelX2: number,
  pixelY2: number,
  displayWidth: number,
  displayHeight: number,
): boolean {
  // 检查是否完全在视口外
  if (pixelX2 < 0 || pixelX1 > displayWidth || pixelY2 < 0 || pixelY1 > displayHeight) {
    return false;
  }
  return true;
}
