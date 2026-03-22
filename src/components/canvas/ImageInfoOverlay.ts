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

    // ── 文件名 ──
    this.nameText.text = truncateFileName(fileName, 30);
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

        // 超出宽度时不再添加
        if (offsetX > itemWidth - LEFT_PADDING) break;
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

/** 截断文件名 */
function truncateFileName(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  const ext = name.lastIndexOf('.');
  if (ext > 0 && name.length - ext <= 5) {
    const namepart = name.substring(0, ext);
    const extpart = name.substring(ext);
    const truncLen = maxLen - 3 - extpart.length;
    if (truncLen > 0) {
      return namepart.substring(0, truncLen) + '...' + extpart;
    }
  }
  return name.substring(0, maxLen - 3) + '...';
}
