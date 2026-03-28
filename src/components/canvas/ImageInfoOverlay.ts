// ============================================================
// 图片信息覆盖层
//
// 底部渐变 + 文件名 Badge + 拍摄参数 Badge
// 纯 PixiJS 对象（非 React 组件）
// ============================================================

import {
  Container,
  Graphics,
  Text,
  type TextStyleOptions,
} from 'pixi.js';
import type { ImageMetadata } from '../../types';

// ─── 样式常量 ─────────────────────────────────────────

/** 覆盖层占图片高度的比例 */
const OVERLAY_HEIGHT_RATIO = 0.15;
/** 最小覆盖层高度 */
const MIN_OVERLAY_HEIGHT = 40;
/** Badge 内边距 */
const BADGE_PADDING_X = 6;
const BADGE_PADDING_Y = 3;
/** Badge 圆角 */
const BADGE_RADIUS = 8;
/** Badge 间距 */
const BADGE_GAP = 4;
/** 底部内边距 */
const BOTTOM_PADDING = 6;
/** 左内边距 */
const LEFT_PADDING = 8;

// ─── 文本样式 ─────────────────────────────────────────

const FILE_NAME_STYLE: TextStyleOptions = {
  fontSize: 11,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fill: 0xFFFFFF,
  fontWeight: '600',
};

const PARAM_STYLE: TextStyleOptions = {
  fontSize: 10,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fill: 0xFFFFFF,
};

// ─── ImageInfoOverlay ────────────────────────────────

export class ImageInfoOverlay extends Container {
  private gradientBg: Graphics;
  private nameText: Text;
  private paramContainer: Container;

  constructor() {
    super();
    this.gradientBg = new Graphics();
    this.nameText = new Text({ text: '', style: FILE_NAME_STYLE });
    this.paramContainer = new Container();

    this.addChild(this.gradientBg);
    this.addChild(this.nameText);
    this.addChild(this.paramContainer);
  }

  /**
   * 更新覆盖层内容和位置
   */
  update(
    itemWidth: number,
    itemHeight: number,
    fileName: string,
    metadata?: ImageMetadata | null,
  ): void {
    const overlayHeight = Math.max(
      MIN_OVERLAY_HEIGHT,
      itemHeight * OVERLAY_HEIGHT_RATIO,
    );
    const overlayY = itemHeight - overlayHeight;

    // ── 渐变背景 ──
    this.gradientBg.clear();
    // 使用两层半透明矩形模拟渐变效果
    this.gradientBg
      .rect(0, overlayY, itemWidth, overlayHeight * 0.4)
      .fill({ color: 0x000000, alpha: 0.2 });
    this.gradientBg
      .rect(0, overlayY + overlayHeight * 0.4, itemWidth, overlayHeight * 0.6)
      .fill({ color: 0x000000, alpha: 0.7 });

    // ── 文件名（根据宽度自适应截断） ──
    const maxChars = maxCharsForWidth(itemWidth);
    this.nameText.text = truncateFileName(fileName, maxChars);
    this.nameText.x = LEFT_PADDING;
    this.nameText.y = overlayY + BOTTOM_PADDING;

    // ── 参数 Badge ──
    this.paramContainer.removeChildren();
    if (metadata) {
      const badges = buildParamBadges(metadata);
      let offsetX = LEFT_PADDING;
      const badgeY = this.nameText.y + this.nameText.height + 3;

      for (const label of badges) {
        const badge = createBadge(label);
        badge.x = offsetX;
        badge.y = badgeY;
        this.paramContainer.addChild(badge);
        offsetX += badge.width + BADGE_GAP;

        // 超出宽度时移除刚添加的 badge 并停止
        if (offsetX > itemWidth - LEFT_PADDING) {
          this.paramContainer.removeChild(badge);
          break;
        }
      }
    }
  }
}

// ─── 辅助函数 ─────────────────────────────────────────

/** 创建 pill 圆角 Badge */
function createBadge(label: string): Container {
  const container = new Container();
  const text = new Text({ text: label, style: PARAM_STYLE });
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
 * 宽图显示更多字符，窄图少显示。
 */
function maxCharsForWidth(itemWidth: number): number {
  // 约 6px / 字符 (fontSize 11，系统字体)
  const availableWidth = itemWidth - LEFT_PADDING * 2;
  const estimated = Math.floor(availableWidth / 6.5);
  // 下限 12 字符（至少显示「abc...xyz.nef」），上限 80
  return Math.max(12, Math.min(80, estimated));
}
