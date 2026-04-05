// ============================================================
// 检测框 Canvas 2D 绘制函数
//
// 纯函数模块，在 Canvas 2D 上下文中绘制鸟类检测框。
// 由 CanvasImageItem.draw() 在图片绘制后调用。
// 调用时 ctx 已处于图片项的局部坐标系（原点在图片左上角）。
// ============================================================

import type { DetectionBox } from '../../types';

// ─── 常量 ─────────────────────────────────────────────

/** 主框颜色（置信度最高的框） */
const PRIMARY_BOX_COLOR = '#22C55E';
/** 副框颜色（其他检测框） */
const SECONDARY_BOX_COLOR = '#EAB308';
/** 框线宽度 */
const BOX_LINE_WIDTH = 2;
/** 折角尺寸（px） */
const CORNER_SIZE = 12;
/** 标签背景色 */
const LABEL_BG_COLOR = '#000000';
/** 标签背景透明度 */
const LABEL_BG_ALPHA = 0.7;
/** 标签字体大小 */
const LABEL_FONT_SIZE = 12;
/** 标签内边距 */
const LABEL_PADDING = 6;
/** 标签圆角半径 */
const LABEL_RADIUS = 4;
/** 最小框尺寸（像素），过小不绘制 */
const MIN_BOX_SIZE = 10;

// ─── 导出函数 ─────────────────────────────────────────

/**
 * 在 Canvas 2D 上绘制检测框覆盖层。
 *
 * @param ctx Canvas 2D 上下文（已 translate 到图片左上角）
 * @param boxes 检测框数组（归一化坐标 [0,1]）
 * @param displayWidth 图片显示宽度（内容像素）
 * @param displayHeight 图片显示高度（内容像素）
 */
export function drawDetectionOverlay(
  ctx: CanvasRenderingContext2D,
  boxes: DetectionBox[],
  displayWidth: number,
  displayHeight: number,
): void {
  if (boxes.length === 0) return;

  // 找到最高置信度
  const maxConfidence = Math.max(...boxes.map((b) => b.confidence));

  ctx.save();

  for (const box of boxes) {
    const isPrimary = box.confidence === maxConfidence;
    drawSingleBox(ctx, box, isPrimary, displayWidth, displayHeight);
  }

  ctx.restore();
}

// ─── 内部函数 ─────────────────────────────────────────

function drawSingleBox(
  ctx: CanvasRenderingContext2D,
  box: DetectionBox,
  isPrimary: boolean,
  displayWidth: number,
  displayHeight: number,
): void {
  const boxW = (box.x2 - box.x1) * displayWidth;
  const boxH = (box.y2 - box.y1) * displayHeight;

  // 最小尺寸过滤
  if (boxW < MIN_BOX_SIZE || boxH < MIN_BOX_SIZE) return;

  // 转换为像素坐标
  const px1 = box.x1 * displayWidth;
  const py1 = box.y1 * displayHeight;
  const px2 = box.x2 * displayWidth;
  const py2 = box.y2 * displayHeight;

  const color = isPrimary ? PRIMARY_BOX_COLOR : SECONDARY_BOX_COLOR;

  // 绘制边框
  drawBoxBorder(ctx, px1, py1, px2, py2, color);

  // 绘制置信度标签
  drawConfidenceLabel(ctx, px1, py1, box.confidence, color);
}

/**
 * 绘制带折角的矩形边框
 */
function drawBoxBorder(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
): void {
  const w = x2 - x1;
  const h = y2 - y1;
  const cs = Math.min(CORNER_SIZE, w / 3, h / 3); // 折角不超过边长的 1/3

  ctx.strokeStyle = color;
  ctx.lineWidth = BOX_LINE_WIDTH;
  ctx.lineJoin = 'miter';

  // 完整矩形边框
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x1, y2);
  ctx.closePath();
  ctx.stroke();

  // 在四个角画加粗折角（增强可视性）
  ctx.lineWidth = BOX_LINE_WIDTH + 1;

  // 左上角
  ctx.beginPath();
  ctx.moveTo(x1, y1 + cs);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x1 + cs, y1);
  ctx.stroke();

  // 右上角
  ctx.beginPath();
  ctx.moveTo(x2 - cs, y1);
  ctx.lineTo(x2, y1);
  ctx.lineTo(x2, y1 + cs);
  ctx.stroke();

  // 右下角
  ctx.beginPath();
  ctx.moveTo(x2, y2 - cs);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2 - cs, y2);
  ctx.stroke();

  // 左下角
  ctx.beginPath();
  ctx.moveTo(x1 + cs, y2);
  ctx.lineTo(x1, y2);
  ctx.lineTo(x1, y2 - cs);
  ctx.stroke();
}

/**
 * 绘制置信度标签 "Bird: XX%"
 */
function drawConfidenceLabel(
  ctx: CanvasRenderingContext2D,
  boxX: number,
  boxY: number,
  confidence: number,
  borderColor: string,
): void {
  const text = `Bird: ${Math.round(confidence * 100)}%`;

  ctx.font = `${LABEL_FONT_SIZE}px system-ui, -apple-system, sans-serif`;
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = LABEL_FONT_SIZE;

  const bgWidth = textWidth + LABEL_PADDING * 2;
  const bgHeight = textHeight + LABEL_PADDING;

  // 标签位置：框的左上角上方
  const labelX = boxX;
  let labelY = boxY - bgHeight - 2;
  if (labelY < 0) {
    // 上方空间不足，放到框内顶部
    labelY = boxY + 2;
  }

  // 绘制背景（圆角矩形）
  ctx.save();
  ctx.globalAlpha = LABEL_BG_ALPHA;
  ctx.fillStyle = LABEL_BG_COLOR;
  roundRect(ctx, labelX, labelY, bgWidth, bgHeight, LABEL_RADIUS);
  ctx.fill();
  ctx.restore();

  // 左侧色条（与边框颜色一致）
  ctx.fillStyle = borderColor;
  ctx.fillRect(labelX, labelY, 3, bgHeight);

  // 绘制文字
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `${LABEL_FONT_SIZE}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillText(text, labelX + LABEL_PADDING, labelY + LABEL_PADDING / 2);
}

/**
 * 绘制圆角矩形路径
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
