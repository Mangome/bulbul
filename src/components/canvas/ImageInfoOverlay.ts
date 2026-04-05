// ============================================================
// 图片信息覆盖层
//
// 底部渐变 + 文件名 Badge + 拍摄参数 Badge
// 纯 PixiJS 对象（非 React 组件）
//
// 文字大小通过 zoomLevel 反向补偿，保证屏幕上始终恒定。
// 渐变背景始终覆盖图片底部，不受缩放影响。
// ============================================================

import {
  Container,
  FillGradient,
  Graphics,
  Text,
  TextStyle,
} from 'pixi.js';
import type { ImageMetadata } from '../../types';

// ─── 样式常量（屏幕像素，不随缩放变化） ─────────────

/** Badge 内边距 */
const BADGE_PADDING_X = 6;
const BADGE_PADDING_Y = 3;
/** Badge 圆角 */
const BADGE_RADIUS = 8;
/** Badge 间距 */
const BADGE_GAP = 4;
/** 文件名与 Badge 行之间的间距 */
const ROW_GAP = 3;
/** 左内边距 */
const LEFT_PADDING = 8;
/** 上下内边距（内容区域到渐变边缘） */
const VERTICAL_PADDING = 8;

/** 文件名基础字号 */
const FILE_NAME_FONT_SIZE = 11;
/** 参数基础字号 */
const PARAM_FONT_SIZE = 10;

/** 合焦评分星级颜色 */
const FOCUS_SCORE_COLORS: Record<number, number> = {
  5: 0x4CAF50,  // 绿色
  4: 0x2196F3,  // 蓝色
  3: 0xFF9800,  // 橙色
  2: 0xF44336,  // 红色
  1: 0xF44336,  // 红色
};

// ─── ImageInfoOverlay ────────────────────────────────

export class ImageInfoOverlay extends Container {
  private gradientBg: Graphics;
  private contentContainer: Container;

  constructor() {
    super();
    this.gradientBg = new Graphics();
    this.contentContainer = new Container();

    this.addChild(this.gradientBg);
    this.addChild(this.contentContainer);
  }

  /**
   * 更新覆盖层内容和位置
   *
   * @param itemWidth   图片宽度（内容坐标）
   * @param itemHeight  图片高度（内容坐标）
   * @param fileName    文件名
   * @param metadata    拍摄参数
   * @param zoomLevel   当前画布缩放级别（默认 1）
   */
  update(
    itemWidth: number,
    itemHeight: number,
    fileName: string,
    metadata?: ImageMetadata | null,
    zoomLevel: number = 1,
  ): void {
    const s = 1 / zoomLevel; // 反向缩放因子
    const z = zoomLevel;

    // ── 1. 先创建文字对象，测量实际高度（屏幕像素） ──
    const nameStyle = new TextStyle({
      fontSize: FILE_NAME_FONT_SIZE,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fill: 0xFFFFFF,
      fontWeight: '600',
    });
    const maxChars = maxCharsForWidth(itemWidth, zoomLevel);
    const nameText = new Text({ text: truncateFileName(fileName, maxChars), style: nameStyle });

    const badgeObjects: Container[] = [];
    if (metadata) {
      const badges = buildParamBadges(metadata);
      const maxX = (itemWidth - LEFT_PADDING) * z;
      let testX = LEFT_PADDING * z;
      for (const label of badges) {
        const badge = createBadge(label);
        testX += badge.width + BADGE_GAP;
        if (testX - BADGE_GAP > maxX) {
          badge.destroy();
          break;
        }
        badgeObjects.push(badge);
      }

      // 合焦评分 Badge（特殊颜色）
      if (metadata.focusScoreMethod === 'Undetected') {
        // 未检测到主体：灰色标记
        const badge = createUndetectedBadge();
        testX += badge.width + BADGE_GAP;
        if (testX - BADGE_GAP <= maxX) {
          badgeObjects.push(badge);
        } else {
          badge.destroy();
        }
      } else if (metadata.focusScore != null) {
        const focusBadge = createFocusScoreBadge(metadata.focusScore);
        testX += focusBadge.width + BADGE_GAP;
        if (testX - BADGE_GAP <= maxX) {
          badgeObjects.push(focusBadge);
        } else {
          focusBadge.destroy();
        }
      }
    }

    const nameH = nameText.height;
    const badgeH = badgeObjects.length > 0 ? badgeObjects[0].height : 0;
    const gap = badgeObjects.length > 0 ? ROW_GAP : 0;
    const totalContentH = nameH + gap + badgeH; // 屏幕像素

    // ── 2. 覆盖层高度 = 内容高度 + 上下 padding，换算到内容坐标 ──
    const overlayScreenH = totalContentH + VERTICAL_PADDING * 2;
    const overlayHeight = overlayScreenH * s; // 内容坐标
    const overlayY = itemHeight - overlayHeight;

    // ── 3. 渐变背景（从透明到半透明黑色，真线性渐变） ──
    this.gradientBg.clear();
    const gradient = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: 'rgba(0,0,0,0)' },
        { offset: 1, color: 'rgba(0,0,0,0.6)' },
      ],
    });
    this.gradientBg
      .rect(0, overlayY, itemWidth, overlayHeight)
      .fill(gradient);

    // ── 4. 文字内容（反向缩放容器） ──
    this.contentContainer.removeChildren();
    this.contentContainer.scale.set(s);

    // 文字固定贴底：距离图片底边 VERTICAL_PADDING 屏幕像素
    const bottomY = itemHeight * z; // 图片底边在容器坐标中的位置
    const contentBottomY = bottomY - VERTICAL_PADDING;
    const startY = contentBottomY - totalContentH;

    nameText.x = LEFT_PADDING * z;
    nameText.y = startY;
    this.contentContainer.addChild(nameText);

    if (badgeObjects.length > 0) {
      let offsetX = LEFT_PADDING * z;
      const badgeY = startY + nameH + gap;
      for (const badge of badgeObjects) {
        badge.x = offsetX;
        badge.y = badgeY;
        this.contentContainer.addChild(badge);
        offsetX += badge.width + BADGE_GAP;
      }
    }
  }
}

// ─── 辅助函数 ─────────────────────────────────────────

/** 创建 pill 圆角 Badge */
function createBadge(label: string): Container {
  const container = new Container();
  const style = new TextStyle({
    fontSize: PARAM_FONT_SIZE,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fill: 0xFFFFFF,
  });
  const text = new Text({ text: label, style });
  const bg = new Graphics();

  const width = text.width + BADGE_PADDING_X * 2;
  const height = text.height + BADGE_PADDING_Y * 2;

  bg.roundRect(0, 0, width, height, BADGE_RADIUS)
    .fill({ color: 0x000000, alpha: 0.5 });

  text.x = BADGE_PADDING_X;
  text.y = BADGE_PADDING_Y;

  container.addChild(bg);
  container.addChild(text);
  return container;
}

/** 创建合焦评分 Badge（带颜色编码） */
function createFocusScoreBadge(score: number): Container {
  const container = new Container();
  const stars = '\u2605'.repeat(score) + '\u2606'.repeat(5 - score);
  const bgColor = FOCUS_SCORE_COLORS[score] ?? 0x666666;

  const style = new TextStyle({
    fontSize: PARAM_FONT_SIZE,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fill: 0xFFFFFF,
  });
  const text = new Text({ text: stars, style });
  const bg = new Graphics();

  const width = text.width + BADGE_PADDING_X * 2;
  const height = text.height + BADGE_PADDING_Y * 2;

  bg.roundRect(0, 0, width, height, BADGE_RADIUS)
    .fill({ color: bgColor, alpha: 0.75 });

  text.x = BADGE_PADDING_X;
  text.y = BADGE_PADDING_Y;

  container.addChild(bg);
  container.addChild(text);
  return container;
}

/** 创建"未检测到主体" Badge（灰色标记） */
function createUndetectedBadge(): Container {
  const container = new Container();
  const label = '未检测到主体';
  const bgColor = 0x999999; // 灰色

  const style = new TextStyle({
    fontSize: PARAM_FONT_SIZE,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fill: 0xFFFFFF,
  });
  const text = new Text({ text: label, style });
  const bg = new Graphics();

  const width = text.width + BADGE_PADDING_X * 2;
  const height = text.height + BADGE_PADDING_Y * 2;

  bg.roundRect(0, 0, width, height, BADGE_RADIUS)
    .fill({ color: bgColor, alpha: 0.75 });

  text.x = BADGE_PADDING_X;
  text.y = BADGE_PADDING_Y;

  container.addChild(bg);
  container.addChild(text);
  return container;
}

/** 从 ImageMetadata 构建拍摄参数标签 */
function buildParamBadges(meta: ImageMetadata): string[] {
  const badges: string[] = [];

  if (meta.fNumber != null) {
    badges.push(`f/${meta.fNumber}`);
  }
  if (meta.exposureTime != null) {
    badges.push(meta.exposureTime);
  }
  if (meta.isoSpeed != null) {
    badges.push(`ISO ${meta.isoSpeed}`);
  }
  if (meta.focalLength != null) {
    badges.push(`${meta.focalLength}mm`);
  }

  return badges;
}

/**
 * 根据可用像素宽度截断文件名。
 * 保留扩展名，中间用 '...' 省略。
 * maxChars 是上限防止极端长字符串进入 PixiJS Text。
 */
function truncateFileName(name: string, maxChars: number): string {
  if (name.length <= maxChars) return name;
  const ext = name.lastIndexOf('.');
  if (ext > 0 && name.length - ext <= 6) {
    const namepart = name.substring(0, ext);
    const extpart = name.substring(ext);
    const truncLen = maxChars - 3 - extpart.length;
    if (truncLen > 0) {
      return namepart.substring(0, truncLen) + '...' + extpart;
    }
  }
  return name.substring(0, maxChars - 3) + '...';
}

/**
 * 根据图片项宽度估算合理的最大字符数。
 * 考虑缩放级别：缩放越大，图片在屏幕上越大，可显示更多字符。
 */
function maxCharsForWidth(itemWidth: number, zoomLevel: number = 1): number {
  // 屏幕上可用像素 = 内容宽度 * zoomLevel
  const screenWidth = (itemWidth - LEFT_PADDING * 2) * zoomLevel;
  // 约 6.5px / 字符 (fontSize 11，系统字体)
  const estimated = Math.floor(screenWidth / 6.5);
  // 下限 12 字符（至少显示「abc...xyz.nef」），上限 80
  return Math.max(12, Math.min(80, estimated));
}
