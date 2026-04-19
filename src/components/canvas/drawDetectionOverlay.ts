// ============================================================
// 检测框 Canvas 2D 绘制函数
//
// 纯函数模块，在 Canvas 2D 上下文中绘制鸟类检测框。
// 由 CanvasImageItem.draw() 在图片绘制后调用。
// 调用时 ctx 已处于图片项的局部坐标系（原点在图片左上角）。
// ============================================================

import type { DetectionBox } from '../../types';

// ─── 常量 ─────────────────────────────────────────────

/** 高置信鸟种框颜色（speciesConfidence >= 阈值） */
const PRIMARY_BOX_COLOR = '#22C55E';
/** 低置信鸟种框颜色（有鸟种名但 speciesConfidence < 阈值） */
const LOW_CONFIDENCE_BOX_COLOR = '#F97316';
/** 仅检测框颜色（无鸟种名） */
const SECONDARY_BOX_COLOR = '#EAB308';
/** 鸟种高置信阈值，>= 此值视为可信鸟种 */
const SPECIES_HIGH_CONFIDENCE = 0.85;
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


  ctx.save();

  for (const box of boxes) {
    const tier = getBoxTier(box);
    drawSingleBox(ctx, box, tier, displayWidth, displayHeight);
  }

  ctx.restore();
}

// ─── 内部函数 ─────────────────────────────────────────

type BoxTier = 'high' | 'low' | 'detect';

/** 根据鸟种置信度判定框的等级 */
function getBoxTier(box: DetectionBox): BoxTier {
  if (box.speciesName) {
    const conf = box.speciesConfidence ?? box.confidence;
    return conf >= SPECIES_HIGH_CONFIDENCE ? 'high' : 'low';
  }
  return 'detect';
}

/** 根据框等级获取颜色 */
function getTierColor(tier: BoxTier): string {
  switch (tier) {
    case 'high': return PRIMARY_BOX_COLOR;
    case 'low': return LOW_CONFIDENCE_BOX_COLOR;
    case 'detect': return SECONDARY_BOX_COLOR;
  }
}

function drawSingleBox(
  ctx: CanvasRenderingContext2D,
  box: DetectionBox,
  tier: BoxTier,
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

  const color = getTierColor(tier);

  // 绘制边框
  drawBoxBorder(ctx, px1, py1, px2, py2, color);

  // 绘制标签
  const label = buildLabel(box, tier);
  drawConfidenceLabel(ctx, px1, py1, label, color);
}

/** 构建标签文本 */
function buildLabel(box: DetectionBox, tier: BoxTier): string {
  if (box.speciesName) {
    const conf = Math.round((box.speciesConfidence ?? box.confidence) * 100);
    return tier === 'high'
      ? `${box.speciesName} ${conf}%`
      : `${box.speciesName}? ${conf}%`;
  }
  return `Bird: ${Math.round(box.confidence * 100)}%`;
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
 * 绘制检测标签
 */
function drawConfidenceLabel(
  ctx: CanvasRenderingContext2D,
  boxX: number,
  boxY: number,
  label: string,
  borderColor: string,
): void {
  const text = label;

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
