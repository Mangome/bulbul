// ============================================================
// 画布图片项
//
// PixiJS Container 封装（非 React 组件），包含：
// - 占位色块（纹理加载前）
// - Sprite（纹理加载后）
// - 信息覆盖层（底部渐变 + Badge）
// ============================================================

import {
  Container,
  Graphics,
  Sprite,
  type Texture,
} from 'pixi.js';
import { ImageInfoOverlay } from './ImageInfoOverlay';
import type { LayoutItem } from '../../utils/layout';
import type { ImageMetadata } from '../../types';

// ─── 常量 ─────────────────────────────────────────────

/** 占位色块颜色 */
const PLACEHOLDER_COLOR = 0xE5E7EB;
/** 信息覆盖层可见的最低缩放级别 */
const INFO_OVERLAY_MIN_ZOOM = 0.3;

// ─── CanvasImageItem ─────────────────────────────────

export class CanvasImageItem extends Container {
  readonly hash: string;
  readonly groupId: number;
  private itemWidth: number;
  private itemHeight: number;

  private placeholder: Graphics;
  private sprite: Sprite | null = null;
  private infoOverlay: ImageInfoOverlay;
  private fileName: string = '';
  private metadata: ImageMetadata | null = null;

  constructor(layoutItem: LayoutItem) {
    super();
    this.hash = layoutItem.hash;
    this.groupId = layoutItem.groupId;
    this.itemWidth = layoutItem.width;
    this.itemHeight = layoutItem.height;

    // 定位
    this.x = layoutItem.x;
    this.y = layoutItem.y;

    // ── 占位色块 ──
    this.placeholder = new Graphics();
    this.placeholder
      .rect(0, 0, this.itemWidth, this.itemHeight)
      .fill(PLACEHOLDER_COLOR);
    this.addChild(this.placeholder);

    // ── 信息覆盖层 ──
    this.infoOverlay = new ImageInfoOverlay();
    this.addChild(this.infoOverlay);
  }

  /** 设置图片元数据（文件名 + 拍摄参数）并刷新覆盖层 */
  setImageInfo(fileName: string, metadata?: ImageMetadata | null): void {
    this.fileName = fileName;
    this.metadata = metadata ?? null;
    this.infoOverlay.update(
      this.itemWidth,
      this.itemHeight,
      this.fileName,
      this.metadata,
    );
  }

  /** 纹理加载完成，替换占位色块 */
  setTexture(texture: Texture): void {
    if (this.sprite) {
      this.removeChild(this.sprite);
      this.sprite.destroy();
    }

    this.sprite = new Sprite(texture);
    this.sprite.width = this.itemWidth;
    this.sprite.height = this.itemHeight;

    // 插入到占位色块和覆盖层之间
    this.addChildAt(this.sprite, 1);

    // 隐藏占位色块
    this.placeholder.visible = false;
  }

  /** 更新信息覆盖层可见性（低缩放时隐藏） */
  updateZoomVisibility(zoomLevel: number): void {
    this.infoOverlay.visible = zoomLevel >= INFO_OVERLAY_MIN_ZOOM;
  }

  /** 清理资源 */
  override destroy(): void {
    this.sprite?.destroy();
    this.placeholder.destroy();
    this.infoOverlay.destroy();
    super.destroy({ children: true });
  }
}
