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
  Texture,
} from 'pixi.js';
import { ImageInfoOverlay } from './ImageInfoOverlay';
import type { LayoutItem } from '../../utils/layout';
import type { ImageMetadata } from '../../types';

// ─── 常量 ─────────────────────────────────────────────

/** 占位色块颜色 */
const PLACEHOLDER_COLOR = 0xE0E4EB;
/** 信息覆盖层可见的最低缩放级别 */
const INFO_OVERLAY_MIN_ZOOM = 0.3;
/** 信息覆盖层从开始淡入到完全可见的缩放区间宽度 */
const INFO_OVERLAY_FADE_RANGE = 0.1;

/** 选中色（品牌靛蓝，在画布背景上辨识度高） */
const SELECTION_COLOR = 0x2563A8;
/** 选中边框宽度 */
const SELECTION_BORDER_WIDTH = 3;
/** 悬停边框宽度 */
const HOVER_BORDER_WIDTH = 2;
/** ✓ 标记圆形半径（增大以提升可见性） */
const CHECK_RADIUS = 13;
/** ✓ 标记右上角偏移 */
const CHECK_OFFSET = 10;
/** 选中叠加层透明度（极轻微品牌色调） */
const SELECTION_OVERLAY_ALPHA = 0.08;
/** 外发光透明度 */
const SELECTION_GLOW_ALPHA = 0.2;

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

  /** 上一次缩放级别，用于反向补偿覆盖层文字大小 */
  private lastZoom: number = 1;

  // 选中/悬停视觉对象（延迟创建）
  private selectionOverlay: Graphics | null = null;
  private selectionBorder: Graphics | null = null;
  private checkMark: Graphics | null = null;
  private hoverBorder: Graphics | null = null;
  private _isSelected: boolean = false;
  private _isHovered: boolean = false;
  /** 选中动画帧 ID，用于取消 */
  private _selAnimFrame: number = 0;

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
      this.lastZoom,
    );
  }

  /** 纹理加载完成，替换占位色块，并根据 EXIF Orientation 旋转 */
  setTexture(texture: Texture): void {
    // 安全检查：纹理的底层资源可能在异步加载期间被 evict 销毁
    if (!texture.source || !texture.source.resource) return;

    if (this.sprite) {
      this.sprite.texture = Texture.EMPTY;
      this.removeChild(this.sprite);
      this.sprite.destroy({ texture: false });
      this.sprite = null;
    }

    this.sprite = new Sprite(texture);
    this._applySpriteTransform();

    // 插入到占位色块和覆盖层之间
    this.addChildAt(this.sprite, 1);

    // 隐藏占位色块
    this.placeholder.visible = false;
  }

  /**
   * 根据 EXIF Orientation 对 sprite 应用旋转/镜像变换
   *
   * EXIF Orientation 标准：
   *   1 = 正常, 2 = 水平镜像, 3 = 旋转180°,
   *   4 = 垂直镜像, 5 = 转置(镜像+270°), 6 = 旋转90°CW,
   *   7 = 转置(镜像+90°), 8 = 旋转270°CW(即90°CCW)
   */
  private _applySpriteTransform(): void {
    const sprite = this.sprite!;
    const orientation = this.metadata?.orientation ?? 1;

    // 重置变换
    sprite.rotation = 0;
    sprite.scale.set(1);
    sprite.position.set(0, 0);

    switch (orientation) {
      case 2: // 水平镜像
        sprite.width = this.itemWidth;
        sprite.height = this.itemHeight;
        sprite.scale.x *= -1;
        sprite.x = this.itemWidth;
        break;

      case 3: // 旋转 180°
        sprite.width = this.itemWidth;
        sprite.height = this.itemHeight;
        sprite.rotation = Math.PI;
        sprite.x = this.itemWidth;
        sprite.y = this.itemHeight;
        break;

      case 4: // 垂直镜像
        sprite.width = this.itemWidth;
        sprite.height = this.itemHeight;
        sprite.scale.y *= -1;
        sprite.y = this.itemHeight;
        break;

      case 5: // 转置：水平镜像 + 270°
        sprite.width = this.itemHeight;
        sprite.height = this.itemWidth;
        sprite.rotation = -Math.PI / 2;
        sprite.scale.x *= -1;
        sprite.x = this.itemWidth;
        break;

      case 6: // 旋转 90° 顺时针
        sprite.width = this.itemHeight;
        sprite.height = this.itemWidth;
        sprite.rotation = Math.PI / 2;
        sprite.x = this.itemWidth;
        break;

      case 7: // 转置：水平镜像 + 90°
        sprite.width = this.itemHeight;
        sprite.height = this.itemWidth;
        sprite.rotation = Math.PI / 2;
        sprite.scale.x *= -1;
        sprite.y = this.itemHeight;
        break;

      case 8: // 旋转 270° 顺时针 (90° 逆时针)
        sprite.width = this.itemHeight;
        sprite.height = this.itemWidth;
        sprite.rotation = -Math.PI / 2;
        sprite.y = this.itemHeight;
        break;

      default: // orientation = 1 或缺失
        sprite.width = this.itemWidth;
        sprite.height = this.itemHeight;
        break;
    }
  }

  /** 更新信息覆盖层可见性（低缩放时淡出，平滑过渡；文字大小不随缩放变化） */
  updateZoomVisibility(zoomLevel: number): void {
    if (zoomLevel < INFO_OVERLAY_MIN_ZOOM) {
      // 低于阈值：完全隐藏
      this.infoOverlay.visible = false;
      this.infoOverlay.alpha = 0;
    } else if (zoomLevel < INFO_OVERLAY_MIN_ZOOM + INFO_OVERLAY_FADE_RANGE) {
      // 过渡区间 [0.3, 0.4)：alpha 线性从 0 到 1
      this.infoOverlay.visible = true;
      this.infoOverlay.alpha =
        (zoomLevel - INFO_OVERLAY_MIN_ZOOM) / INFO_OVERLAY_FADE_RANGE;
    } else {
      // 完全可见
      this.infoOverlay.visible = true;
      this.infoOverlay.alpha = 1;
    }

    // 缩放变化时重新布局覆盖层，使文字大小保持恒定
    this.lastZoom = zoomLevel;
    if (this.fileName) {
      this.infoOverlay.update(
        this.itemWidth,
        this.itemHeight,
        this.fileName,
        this.metadata,
        zoomLevel,
      );
    }
  }

  /** 设置选中状态视觉（带渐入/渐出动画） */
  setSelected(selected: boolean): void {
    if (this._isSelected === selected) return;
    this._isSelected = selected;

    // 取消上一次动画
    if (this._selAnimFrame) {
      cancelAnimationFrame(this._selAnimFrame);
      this._selAnimFrame = 0;
    }

    if (selected) {
      this._ensureSelectionGraphics();
      this.selectionOverlay!.visible = true;
      this.selectionBorder!.visible = true;
      this.checkMark!.visible = true;
      this._animateSelectionIn();
    } else {
      if (this.selectionBorder && this.checkMark) {
        this._animateSelectionOut();
      }
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
    if (this._selAnimFrame) {
      cancelAnimationFrame(this._selAnimFrame);
    }
    this.off('pointerover', this._onPointerOver, this);
    this.off('pointerout', this._onPointerOut, this);

    // 先将纹理设为 EMPTY，解除 Sprite 及其 GPU 侧 BatchableSprite 对纹理的引用
    // 这样即使渲染管线在下一帧仍访问该 Sprite，也不会触碰已销毁的 TextureSource
    if (this.sprite) {
      this.sprite.texture = Texture.EMPTY;
      this.sprite.destroy({ texture: false });
      this.sprite = null;
    }

    this.placeholder.destroy();
    this.infoOverlay.destroy();
    this.selectionOverlay?.destroy();
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

  /** 延迟创建选中叠加层 + 边框 + ✓ 标记 */
  private _ensureSelectionGraphics(): void {
    // ── 半透明叠加层：让选中图片有轻微品牌色调 ──
    if (!this.selectionOverlay) {
      this.selectionOverlay = new Graphics();
      this.selectionOverlay
        // 全尺寸半透明色调覆盖
        .rect(0, 0, this.itemWidth, this.itemHeight)
        .fill({ color: SELECTION_COLOR, alpha: SELECTION_OVERLAY_ALPHA })
        // 内侧 1px 品牌色线（内发光效果）
        .rect(0, 0, this.itemWidth, this.itemHeight)
        .stroke({ color: SELECTION_COLOR, width: 1, alpha: 0.15 });
      this.selectionOverlay.visible = false;
      this.addChild(this.selectionOverlay);
    }

    // ── 选中边框：外发光 + 实色边框 ──
    if (!this.selectionBorder) {
      this.selectionBorder = new Graphics();
      this.selectionBorder
        // 外发光（品牌色半透明扩散）
        .rect(
          -SELECTION_BORDER_WIDTH - 3,
          -SELECTION_BORDER_WIDTH - 3,
          this.itemWidth + (SELECTION_BORDER_WIDTH + 3) * 2,
          this.itemHeight + (SELECTION_BORDER_WIDTH + 3) * 2,
        )
        .stroke({ color: SELECTION_COLOR, width: 3, alpha: SELECTION_GLOW_ALPHA })
        // 实色选中边框
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

    // ── ✓ 标记：增大 + 白色外环 ──
    if (!this.checkMark) {
      this.checkMark = new Graphics();
      const cx = this.itemWidth - CHECK_OFFSET - CHECK_RADIUS;
      const cy = CHECK_OFFSET + CHECK_RADIUS;
      // 白色外环（提升对比度）
      this.checkMark
        .circle(cx, cy, CHECK_RADIUS + 2)
        .fill({ color: 0xFFFFFF, alpha: 0.9 });
      // 品牌色圆形背景
      this.checkMark
        .circle(cx, cy, CHECK_RADIUS)
        .fill(SELECTION_COLOR);
      // 白色 ✓ 线条（加粗 + 路径放大）
      this.checkMark
        .moveTo(cx - 5, cy)
        .lineTo(cx - 1.5, cy + 4)
        .lineTo(cx + 6, cy - 5)
        .stroke({ color: 0xFFFFFF, width: 2.5 });
      this.checkMark.visible = false;
      this.addChild(this.checkMark);
    }
  }

  /** 延迟创建悬停边框（品牌色系） */
  private _ensureHoverGraphics(): void {
    if (!this.hoverBorder) {
      this.hoverBorder = new Graphics();
      this.hoverBorder
        // 外发光（品牌色半透明扩散）
        .rect(
          -HOVER_BORDER_WIDTH - 2,
          -HOVER_BORDER_WIDTH - 2,
          this.itemWidth + (HOVER_BORDER_WIDTH + 2) * 2,
          this.itemHeight + (HOVER_BORDER_WIDTH + 2) * 2,
        )
        .stroke({ color: SELECTION_COLOR, width: 3, alpha: 0.2 })
        // 品牌色悬停边框
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

  // ── 选中动画 ────────────────────────────────────────

  /** 选中动画时长（ms）— 尊重 prefers-reduced-motion */
  private static readonly SEL_ANIM_DURATION =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : 200;

  /** 选中时渐入动画：叠加层 + 边框 alpha 0→1，checkmark scale 0→1（弹性） */
  private _animateSelectionIn(): void {
    const overlay = this.selectionOverlay!;
    const border = this.selectionBorder!;
    const check = this.checkMark!;
    const cx = this.itemWidth - CHECK_OFFSET - CHECK_RADIUS;
    const cy = CHECK_OFFSET + CHECK_RADIUS;

    overlay.alpha = 0;
    border.alpha = 0;
    check.scale.set(0);
    check.pivot.set(cx, cy);
    check.position.set(cx, cy);

    const start = performance.now();
    const duration = CanvasImageItem.SEL_ANIM_DURATION;

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);

      // 叠加层 + 边框渐入
      overlay.alpha = t;
      border.alpha = t;

      // checkmark 弹性缩放（overshoot）
      const s = t < 1
        ? 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 0.5)
        : 1;
      check.scale.set(s);

      if (t < 1) {
        this._selAnimFrame = requestAnimationFrame(tick);
      } else {
        this._selAnimFrame = 0;
      }
    };

    this._selAnimFrame = requestAnimationFrame(tick);
  }

  /** 取消选中时渐出动画：alpha 1→0，完成后隐藏 */
  private _animateSelectionOut(): void {
    const overlay = this.selectionOverlay!;
    const border = this.selectionBorder!;
    const check = this.checkMark!;
    const start = performance.now();
    const duration = CanvasImageItem.SEL_ANIM_DURATION * 0.6; // 渐出更快

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const alpha = 1 - t;

      overlay.alpha = alpha;
      border.alpha = alpha;
      check.alpha = alpha;

      if (t < 1) {
        this._selAnimFrame = requestAnimationFrame(tick);
      } else {
        overlay.visible = false;
        border.visible = false;
        check.visible = false;
        border.alpha = 1;
        check.alpha = 1;
        overlay.alpha = 1;
        check.scale.set(1);
        this._selAnimFrame = 0;
      }
    };

    this._selAnimFrame = requestAnimationFrame(tick);
  }
}
