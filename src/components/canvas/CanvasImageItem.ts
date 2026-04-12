// ============================================================
// Canvas 2D 画布图片项（缩略图模式）
//
// 纯 Canvas 2D 实现，替代 PixiJS Container。
// 包含：
// - 占位色块（图片加载前）
// - 图片绘制（应用 EXIF Orientation 变换）
// - 信息覆盖层（文件名 + 拍摄参数）
// - 选中效果：半透明蓝色遮罩 + 右上角小对勾
// - 检测框覆盖层
// - AABB 命中检测
// ============================================================

import type { LayoutItem } from '../../utils/layout';
import type { ImageMetadata, DetectionBox } from '../../types';
import { drawDetectionOverlay } from './drawDetectionOverlay';

// ─── 常量 ─────────────────────────────────────────────

/** 占位色块颜色 */
const PLACEHOLDER_COLOR = '#E0E4EB';

/** 选中色（品牌靛蓝，在画布背景上辨识度高） */
const SELECTION_COLOR = '#2563A8';
/** 选中叠加层透明度 */
const SELECTION_OVERLAY_ALPHA = 0.08;
/** 选中动画时长（ms）— 尊重 prefers-reduced-motion */
const getSelAnimDuration = (): number => {
  if (typeof window === 'undefined') return 200;
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  return prefersReduced ? 0 : 200;
};

// ─── 信息覆盖层常量 ─────────────────────────────────

/** 文字视觉大小（不随缩放变化） */
const INFO_FONT_SIZE = 11;
const INFO_FONT_NAME = `600 ${INFO_FONT_SIZE}px system-ui, -apple-system, sans-serif`;
const INFO_FONT_PARAMS = `400 ${INFO_FONT_SIZE}px system-ui, -apple-system, sans-serif`;
const INFO_TEXT_COLOR = '#FFFFFF';
const INFO_TEXT_SECONDARY = 'rgba(255, 255, 255, 0.85)';
/** 渐变背景高度占图片高度的比例 */
const INFO_GRADIENT_RATIO = 0.30;
/** 内边距（屏幕像素，会被反向缩放） */
const INFO_PADDING_X = 8;
const INFO_PADDING_BOTTOM = 6;
const INFO_LINE_GAP = 3;
/** 估算字符宽度（用于截断，避免 measureText） */
const INFO_CHAR_WIDTH = 6.5;
const STAR_FILLED = '\u2605'; // ★
const STAR_EMPTY = '\u2606';  // ☆

// ─── CanvasImageItem ─────────────────────────────────

export class CanvasImageItem {
  readonly hash: string;
  readonly groupId: number;

  // 布局信息
  x: number;
  y: number;
  private width: number;
  private height: number;

  // 图片和元数据
  private image: ImageBitmap | null = null;
  private orientation: number = 1;

  // 视觉状态
  alpha: number = 1;
  private _isSelected: boolean = false;

  // 选中动画状态
  private selectionAnimStartTime: number = 0;
  private selectionAnimDirection: 'in' | 'out' = 'in';

  // 检测框
  private detectionBoxes: DetectionBox[] = [];
  private detectionVisible: boolean = false;

  // 信息覆盖层数据（预计算字符串，避免每帧格式化）
  private infoFileName: string = '';
  private infoCaptureTime: string = '';
  private infoParams: string = '';
  private infoVisible: boolean = false;

  // 重新加载标志：图片被 LRU 淘汰后需要重新加载
  needsReload: boolean = false;


  constructor(layoutItem: LayoutItem) {
    this.hash = layoutItem.hash;
    this.groupId = layoutItem.groupId;
    this.x = layoutItem.x;
    this.y = layoutItem.y;
    this.width = layoutItem.width;
    this.height = layoutItem.height;
  }

  // ── 公共方法 ────────────────────────────────────────

  /**
   * 设置图片内容
   * @param image ImageBitmap 对象
   * @param orientation EXIF Orientation (1-8)
   */
  setImage(image: ImageBitmap, orientation?: number): void {
    this.image = image;
    this.orientation = orientation ?? 1;
    this.needsReload = false;
  }

  /** 获取布局宽度（用于确定加载图片质量） */
  getWidth(): number {
    return this.width;
  }

  /** 获取布局高度 */
  getHeight(): number {
    return this.height;
  }

  /**
   * 设置图片信息（文件名 + 拍摄参数）
   * 预格式化参数字符串，避免 draw() 中每帧重复计算
   */
  setImageInfo(fileName: string, metadata?: ImageMetadata | null): void {
    this.infoFileName = fileName;
    this.infoCaptureTime = CanvasImageItem._formatCaptureTime(metadata?.captureTime);
    this.infoParams = CanvasImageItem._formatParams(metadata);
    this.infoVisible = fileName.length > 0;
  }

  /**
   * AABB 命中检测
   * @param contentX 内容坐标 X
   * @param contentY 内容坐标 Y
   * @returns 是否命中此项
   */
  hitTest(contentX: number, contentY: number): boolean {
    return (
      contentX >= this.x &&
      contentX <= this.x + this.width &&
      contentY >= this.y &&
      contentY <= this.y + this.height
    );
  }

  /**
   * 核心绘制方法
   * @param ctx Canvas 2D 上下文
   * @param zoom 缩放级别
   * @param now 当前时间戳（performance.now()）
   * @returns 是否需要继续渲染下一帧（动画进行中）
   */
  draw(ctx: CanvasRenderingContext2D, zoom: number, now: number): boolean {
    // alpha <= 0 时跳过绘制
    if (this.alpha <= 0) {
      return false;
    }

    ctx.save();

    // 平移到此项的位置
    ctx.translate(this.x, this.y);

    // 应用 alpha
    ctx.globalAlpha = this.alpha;

    let needsNextFrame = false;

    // 绘制占位色块或图片
    if (this.image && this._isImageUsable()) {
      this._drawImageWithOrientation(ctx);
    } else {
      // image 被 LRU 缓存淘汰（close()）后变为 detached，标记需要重新加载
      if (this.image) {
        this.image = null;
        this.needsReload = true;
      }
      this._drawPlaceholder(ctx);
    }

    // 绘制信息覆盖层（文件名 + 拍摄参数）
    this._drawInfoOverlay(ctx, zoom);

    // 绘制检测框覆盖层
    if (this.detectionVisible && this.detectionBoxes.length > 0) {
      drawDetectionOverlay(ctx, this.detectionBoxes, this.width, this.height);
    }

    // 绘制选中效果
    if (this._isSelected) {
      const animNeedsFrame = this._updateSelectionAnimation(now);
      needsNextFrame = needsNextFrame || animNeedsFrame;

      this._drawSelection(ctx);
    }

    ctx.restore();

    return needsNextFrame;
  }

  /**
   * 设置选中状态（带动画）
   */
  setSelected(selected: boolean): void {
    if (this._isSelected === selected) return;
    this._isSelected = selected;

    if (selected) {
      this.selectionAnimStartTime = performance.now();
      this.selectionAnimDirection = 'in';
    } else {
      this.selectionAnimStartTime = performance.now();
      this.selectionAnimDirection = 'out';
    }
  }

  /**
   * 设置悬停状态 — 缩略图模式下为 no-op
   * 悬停反馈由 Magnifier 组件提供
   */
  setHovered(_hovered: boolean): void {
    // no-op: 缩略图模式不绘制悬停效果
  }

  /**
   * 设置检测框数据
   */
  setDetectionBoxes(boxes: DetectionBox[]): void {
    this.detectionBoxes = boxes;
  }

  /**
   * 控制检测框显示/隐藏
   */
  setDetectionVisible(visible: boolean): void {
    this.detectionVisible = visible;
  }

  get isSelected(): boolean {
    return this._isSelected;
  }

  /**
   * 清理资源
   */
  destroy(): void {
    // 不触碰 ImageBitmap，生命周期由 ImageCache 管理
    this.image = null;
    this.selectionAnimStartTime = 0;
    this.detectionBoxes = [];
    this.detectionVisible = false;
  }

  /**
   * 检测 ImageBitmap 是否仍可用（未被 close() 释放）
   * close() 后 width/height 归零
   */
  private _isImageUsable(): boolean {
    return this.image !== null && this.image.width > 0 && this.image.height > 0;
  }

  // ── 私有方法：绘制 ────────────────────────────────────────

  /** 绘制占位色块 */
  private _drawPlaceholder(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = PLACEHOLDER_COLOR;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * 绘制信息覆盖层（文件名 + 拍摄参数）
   * 使用反向缩放补偿保持文字恒定大小
   */
  private _drawInfoOverlay(ctx: CanvasRenderingContext2D, zoom: number): void {
    if (!this.infoVisible) return;
    if (!this.infoFileName && !this.infoParams) return;

    const w = this.width;
    const h = this.height;
    const invZoom = 1 / zoom;

    const hasParams = this.infoParams.length > 0;
    const lineCount = hasParams ? 2 : 1;

    // 覆盖层高度（屏幕像素 → 内容坐标）
    const overlayLogicalH = lineCount * INFO_FONT_SIZE + (lineCount - 1) * INFO_LINE_GAP + INFO_PADDING_BOTTOM * 2;
    const overlayContentH = overlayLogicalH * invZoom;
    const gradientContentH = Math.max(overlayContentH, h * INFO_GRADIENT_RATIO);

    ctx.save();

    // 绘制渐变背景
    const gradientY = h - gradientContentH;
    const gradient = ctx.createLinearGradient(0, gradientY, 0, h);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.4, 'rgba(0, 0, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, gradientY, w, gradientContentH);

    // 反向缩放：移到图片底部，1 单位 = 1 屏幕像素
    ctx.translate(0, h);
    ctx.scale(invZoom, invZoom);

    const textX = INFO_PADDING_X;
    const maxTextWidth = w * zoom - INFO_PADDING_X * 2;

    // 文件名 + 拍摄时间拼接为一行
    const nameWithTime = this.infoCaptureTime
      ? `${this.infoFileName}  ${this.infoCaptureTime}`
      : this.infoFileName;

    if (hasParams) {
      // 参数行（底部）
      const paramsY = -INFO_PADDING_BOTTOM;
      ctx.font = INFO_FONT_PARAMS;
      ctx.fillStyle = INFO_TEXT_SECONDARY;
      ctx.textBaseline = 'bottom';
      ctx.fillText(this.infoParams, textX, paramsY, maxTextWidth);

      // 文件名 + 时间行（参数行上方）
      const nameY = paramsY - INFO_FONT_SIZE - INFO_LINE_GAP;
      ctx.font = INFO_FONT_NAME;
      ctx.fillStyle = INFO_TEXT_COLOR;
      const truncatedName = CanvasImageItem._truncateText(nameWithTime, maxTextWidth);
      ctx.fillText(truncatedName, textX, nameY, maxTextWidth);
    } else {
      // 仅文件名 + 时间
      const nameY = -INFO_PADDING_BOTTOM;
      ctx.font = INFO_FONT_NAME;
      ctx.fillStyle = INFO_TEXT_COLOR;
      ctx.textBaseline = 'bottom';
      const truncatedName = CanvasImageItem._truncateText(nameWithTime, maxTextWidth);
      ctx.fillText(truncatedName, textX, nameY, maxTextWidth);
    }

    ctx.restore();
  }

  /**
   * 绘制图片，应用 EXIF Orientation 变换
   */
  private _drawImageWithOrientation(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    const w = this.width;
    const h = this.height;
    const orientation = this.orientation;

    switch (orientation) {
      case 1: // 正常
      default:
        ctx.drawImage(this.image!, 0, 0, w, h);
        break;

      case 2: // 水平镜像
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(this.image!, 0, 0, w, h);
        break;

      case 3: // 旋转 180°
        ctx.translate(w, h);
        ctx.rotate(Math.PI);
        ctx.drawImage(this.image!, 0, 0, w, h);
        break;

      case 4: // 垂直镜像
        ctx.translate(0, h);
        ctx.scale(1, -1);
        ctx.drawImage(this.image!, 0, 0, w, h);
        break;

      case 5: // 转置：水平镜像 + 270°
        ctx.translate(w, 0);
        ctx.rotate(Math.PI / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(this.image!, 0, 0, h, w);
        break;

      case 6: // 旋转 90° 顺时针
        ctx.translate(w, 0);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(this.image!, 0, 0, h, w);
        break;

      case 7: // 转置：水平镜像 + 90°
        ctx.translate(0, h);
        ctx.rotate(Math.PI / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(this.image!, 0, 0, h, w);
        break;

      case 8: // 旋转 270° 顺时针 (90° 逆时针)
        ctx.translate(0, h);
        ctx.rotate(-Math.PI / 2);
        ctx.drawImage(this.image!, 0, 0, h, w);
        break;
    }

    ctx.restore();
  }

  /**
   * 绘制选中效果：半透明蓝色遮罩 + 右上角小对勾
   */
  private _drawSelection(ctx: CanvasRenderingContext2D): void {
    const now = performance.now();
    const elapsed = now - this.selectionAnimStartTime;
    const duration = getSelAnimDuration();

    let progress = Math.min(elapsed / duration, 1);
    if (this.selectionAnimDirection === 'out') {
      const outDuration = duration * 0.6;
      progress = Math.min(elapsed / outDuration, 1);
      progress = 1 - progress;
    }

    const baseAlpha = this.alpha;
    ctx.save();

    // 半透明蓝色遮罩
    ctx.globalAlpha = baseAlpha * progress * SELECTION_OVERLAY_ALPHA;
    ctx.fillStyle = SELECTION_COLOR;
    ctx.fillRect(0, 0, this.width, this.height);

    // 右上角小对勾
    const checkSize = Math.min(this.width, this.height) * 0.15;
    const cx = this.width - checkSize;
    const cy = checkSize;

    ctx.globalAlpha = baseAlpha * progress;

    // 品牌色圆形背景
    ctx.fillStyle = SELECTION_COLOR;
    ctx.beginPath();
    ctx.arc(cx, cy, checkSize * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // 白色对勾
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(1.5, checkSize * 0.15);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - checkSize * 0.25, cy);
    ctx.lineTo(cx - checkSize * 0.05, cy + checkSize * 0.2);
    ctx.lineTo(cx + checkSize * 0.3, cy - checkSize * 0.25);
    ctx.stroke();

    ctx.restore();
  }

  // ── 私有方法：动画、计算与格式化 ────────────────────────────────────────

  /**
   * 更新选中动画状态
   * @returns 是否需要继续渲染
   */
  private _updateSelectionAnimation(now: number): boolean {
    const elapsed = now - this.selectionAnimStartTime;
    const duration = this.selectionAnimDirection === 'in'
      ? getSelAnimDuration()
      : getSelAnimDuration() * 0.6;

    return elapsed < duration;
  }

  /** 格式化拍摄参数为显示字符串 */
  private static _formatParams(meta?: ImageMetadata | null): string {
    if (!meta) return '';
    const parts: string[] = [];

    if (meta.fNumber != null) parts.push(`f/${meta.fNumber}`);
    if (meta.exposureTime != null) parts.push(`${meta.exposureTime}s`);
    if (meta.isoSpeed != null) parts.push(`ISO ${meta.isoSpeed}`);
    if (meta.focalLength != null) parts.push(`${meta.focalLength}mm`);
    if (meta.focusScore != null) {
      const score = Math.round(Math.max(1, Math.min(5, meta.focusScore)));
      parts.push(STAR_FILLED.repeat(score) + STAR_EMPTY.repeat(5 - score));
    }

    return parts.join(' \u00B7 ');
  }

  /** 格式化拍摄时间：ISO 字符串 → YYYY-MM-DD HH:mm:ss */
  private static _formatCaptureTime(captureTime?: string | null): string {
    if (!captureTime) return '';
    // captureTime 为 ISO 格式如 "2024-01-01T14:30:00"
    const d = new Date(captureTime);
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const MM = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`;
  }

  /** 基于字符宽度估算截断文本（避免每帧 measureText） */
  private static _truncateText(text: string, maxWidthPx: number): string {
    const maxChars = Math.floor(maxWidthPx / INFO_CHAR_WIDTH);
    if (text.length <= maxChars) return text;
    if (maxChars < 8) return text.substring(0, 5) + '...';
    return text.substring(0, maxChars - 3) + '...';
  }
}
