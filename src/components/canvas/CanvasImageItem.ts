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

/** 选中边框颜色 */
const SELECTION_COLOR = 0x3B82F6;
/** 选中边框宽度 */
const SELECTION_BORDER_WIDTH = 3;
/** 悬停边框宽度 */
const HOVER_BORDER_WIDTH = 2;
/** ✓ 标记圆形半径 */
const CHECK_RADIUS = 10;
/** ✓ 标记右上角偏移 */
const CHECK_OFFSET = 8;

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

  // 选中/悬停视觉对象（延迟创建）
  private selectionBorder: Graphics | null = null;
  private checkMark: Graphics | null = null;
  private hoverBorder: Graphics | null = null;
  private _isSelected: boolean = false;
  private _isHovered: boolean = false;

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

    // ── 交互设置 ──
    this.eventMode = 'static';
    this.on('pointerover', this._onPointerOver, this);
    this.on('pointerout', this._onPointerOut, this);
  }

  // ── 公共方法 ────────────────────────────────────────

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

  /** 设置选中状态视觉 */
  setSelected(selected: boolean): void {
    if (this._isSelected === selected) return;
    this._isSelected = selected;

    if (selected) {
      this._ensureSelectionGraphics();
      this.selectionBorder!.visible = true;
      this.checkMark!.visible = true;
    } else {
      if (this.selectionBorder) this.selectionBorder.visible = false;
      if (this.checkMark) this.checkMark.visible = false;
    }
  }

  /** 设置悬停状态视觉 */
  setHovered(hovered: boolean): void {
    if (this._isHovered === hovered) return;
    this._isHovered = hovered;

    if (hovered && !this._isSelected) {
      this._ensureHoverGraphics();
      this.hoverBorder!.visible = true;
    } else {
      if (this.hoverBorder) this.hoverBorder.visible = false;
    }
  }

  get isSelected(): boolean {
    return this._isSelected;
  }

  /** 清理资源 */
  override destroy(): void {
    this.off('pointerover', this._onPointerOver, this);
    this.off('pointerout', this._onPointerOut, this);
    this.sprite?.destroy();
    this.placeholder.destroy();
    this.infoOverlay.destroy();
    this.selectionBorder?.destroy();
    this.checkMark?.destroy();
    this.hoverBorder?.destroy();
    super.destroy({ children: true });
  }

  // ── 私有方法 ────────────────────────────────────────

  private _onPointerOver(): void {
    this.setHovered(true);
  }

  private _onPointerOut(): void {
    this.setHovered(false);
  }

  /** 延迟创建选中边框 + ✓ 标记 */
  private _ensureSelectionGraphics(): void {
    if (!this.selectionBorder) {
      this.selectionBorder = new Graphics();
      this.selectionBorder
        // 外阴影（用白色边框模拟）
        .rect(
          -SELECTION_BORDER_WIDTH - 2,
          -SELECTION_BORDER_WIDTH - 2,
          this.itemWidth + (SELECTION_BORDER_WIDTH + 2) * 2,
          this.itemHeight + (SELECTION_BORDER_WIDTH + 2) * 2,
        )
        .stroke({ color: 0xFFFFFF, width: 2, alpha: 0.6 })
        // 蓝色选中边框
        .rect(
          -SELECTION_BORDER_WIDTH / 2,
          -SELECTION_BORDER_WIDTH / 2,
          this.itemWidth + SELECTION_BORDER_WIDTH,
          this.itemHeight + SELECTION_BORDER_WIDTH,
        )
        .stroke({ color: SELECTION_COLOR, width: SELECTION_BORDER_WIDTH });
      this.selectionBorder.visible = false;
      this.addChild(this.selectionBorder);
    }

    if (!this.checkMark) {
      this.checkMark = new Graphics();
      const cx = this.itemWidth - CHECK_OFFSET - CHECK_RADIUS;
      const cy = CHECK_OFFSET + CHECK_RADIUS;
      // 蓝色圆形背景
      this.checkMark
        .circle(cx, cy, CHECK_RADIUS)
        .fill(SELECTION_COLOR);
      // 白色 ✓ 线条
      this.checkMark
        .moveTo(cx - 4, cy)
        .lineTo(cx - 1, cy + 3)
        .lineTo(cx + 5, cy - 4)
        .stroke({ color: 0xFFFFFF, width: 2 });
      this.checkMark.visible = false;
      this.addChild(this.checkMark);
    }
  }

  /** 延迟创建悬停边框 */
  private _ensureHoverGraphics(): void {
    if (!this.hoverBorder) {
      this.hoverBorder = new Graphics();
      this.hoverBorder
        // 外发光（用更宽的半透明边框模拟）
        .rect(
          -HOVER_BORDER_WIDTH - 2,
          -HOVER_BORDER_WIDTH - 2,
          this.itemWidth + (HOVER_BORDER_WIDTH + 2) * 2,
          this.itemHeight + (HOVER_BORDER_WIDTH + 2) * 2,
        )
        .stroke({ color: SELECTION_COLOR, width: 3, alpha: 0.25 })
        // 蓝色悬停边框
        .rect(
          -HOVER_BORDER_WIDTH / 2,
          -HOVER_BORDER_WIDTH / 2,
          this.itemWidth + HOVER_BORDER_WIDTH,
          this.itemHeight + HOVER_BORDER_WIDTH,
        )
        .stroke({ color: SELECTION_COLOR, width: HOVER_BORDER_WIDTH });
      this.hoverBorder.visible = false;
      this.addChild(this.hoverBorder);
    }
  }
}
