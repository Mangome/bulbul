// ============================================================
// Canvas 2D 画布图片项（缩略图模式）
//
// 纯 Canvas 2D 实现，替代 PixiJS Container。
// 包含：
// - 占位色块（图片加载前）
// - 图片绘制（应用 EXIF Orientation 变换）
// - 信息覆盖层（文件名 + 拍摄参数）
// - 选中效果：内缩边框 + 右上角精致角标
// - 检测框覆盖层
// - AABB 命中检测
// ============================================================

import type { LayoutItem } from '../../utils/layout';
import type { ImageMetadata, DetectionBox } from '../../types';
import { drawDetectionOverlay } from './drawDetectionOverlay';
import { easeOutQuart } from '../../utils/easing';

// ─── 常量 ─────────────────────────────────────────────

/** 占位色块颜色 */
const PLACEHOLDER_COLOR = '#E0E4EB';

/** 选中色（品牌靛蓝，在画布背景上辨识度高） */
const SELECTION_COLOR = '#2563A8';
/** 选中边框宽度（屏幕像素） */
const SELECTION_BORDER_WIDTH = 2.5;
/** 对勾角标半径（屏幕像素） */
const SELECTION_BADGE_RADIUS = 10;
/** 角标距离图片边缘的偏移（屏幕像素） */
const SELECTION_BADGE_OFFSET = 8;
/** 选中动画时长（ms）— 尊重 prefers-reduced-motion */
const getSelAnimDuration = (): number => {
  if (typeof window === 'undefined') return 200;
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  return prefersReduced ? 0 : 200;
};

// ─── 悬停态常量 ─────────────────────────────────────
/** 悬停边框颜色（亮色中性线，在任何底图上都清晰） */
const HOVER_BORDER_COLOR = 'rgba(255, 255, 255, 0.65)';
const HOVER_BORDER_SHADOW = 'rgba(0, 0, 0, 0.35)';
/** 悬停边框宽度（屏幕像素） */
const HOVER_BORDER_WIDTH = 1.5;
/** 悬停动画时长（ms） */
const getHoverAnimDuration = (): number => {
  if (typeof window === 'undefined') return 150;
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  return prefersReduced ? 0 : 150;
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

// ─── 分组角标常量 ─────────────────────────────────────

const GROUP_BADGE_FONT = '700 10px system-ui, -apple-system, sans-serif';
const GROUP_BADGE_BG = 'rgba(0, 0, 0, 0.55)';
const GROUP_BADGE_TEXT_COLOR = '#FFFFFF';
const GROUP_BADGE_PADDING_X = 8;
const GROUP_BADGE_PADDING_Y = 4;
const GROUP_BADGE_OFFSET = 6;
const GROUP_BADGE_RADIUS = 3;

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
  private _isHovered: boolean = false;

  // 选中动画状态
  private selectionAnimStartTime: number = 0;
  private selectionAnimDirection: 'in' | 'out' = 'in';

  // 悬停动画状态（rAF 驱动，与选中动画同构）
  private hoverAnimStartTime: number = 0;
  private hoverAnimDirection: 'in' | 'out' = 'out';
  /** 最近一帧的 hover progress（0-1），用于避免动画完成后继续请求帧 */
  private hoverAnimValue: number = 0;

  // 检测框
  private detectionBoxes: DetectionBox[] = [];
  private detectionVisible: boolean = false;

  // 信息覆盖层数据（预计算字符串，避免每帧格式化）
  private infoFileName: string = '';
  private infoCaptureTime: string = '';
  private infoParams: string = '';
  private infoVisible: boolean = false;

  // 分组角标
  private _isFirstInGroup: boolean = false;
  private _groupLabel: string = '';

  // 重新加载标志：图片被 LRU 淘汰后需要重新加载
  needsReload: boolean = false;


  constructor(layoutItem: LayoutItem) {
    this.hash = layoutItem.hash;
    this.groupId = layoutItem.groupId;
    this.x = layoutItem.x;
    this.y = layoutItem.y;
    this.width = layoutItem.width;
    this.height = layoutItem.height;
    this._isFirstInGroup = layoutItem.isFirstInGroup;
    this._groupLabel = layoutItem.groupLabel;
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

    // 绘制分组角标（首图左上角）
    this._drawGroupBadge(ctx, zoom);

    // 绘制信息覆盖层（文件名 + 拍摄参数）
    this._drawInfoOverlay(ctx, zoom);

    // 绘制检测框覆盖层
    if (this.detectionVisible && this.detectionBoxes.length > 0) {
      drawDetectionOverlay(ctx, this.detectionBoxes, this.width, this.height);
    }

    // 绘制悬停效果（仅在未选中时）
    const hoverAnimNeedsFrame = this._updateHoverAnimation(now);
    needsNextFrame = needsNextFrame || hoverAnimNeedsFrame;
    if (!this._isSelected && this.hoverAnimValue > 0.01) {
      this._drawHover(ctx, zoom);
    }

    // 绘制选中效果
    if (this._isSelected) {
      const animNeedsFrame = this._updateSelectionAnimation(now);
      needsNextFrame = needsNextFrame || animNeedsFrame;

      this._drawSelection(ctx, zoom);
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
   * 设置悬停状态（带 150ms easeOutQuart 补间）
   * 非选中态下显示 1.5px 轻描边；选中态下为 no-op（避免视觉叠加）
   */
  setHovered(hovered: boolean): void {
    if (this._isHovered === hovered) return;
    this._isHovered = hovered;
    this.hoverAnimStartTime = performance.now();
    this.hoverAnimDirection = hovered ? 'in' : 'out';
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
    this.hoverAnimStartTime = 0;
    this.hoverAnimValue = 0;
    this._isHovered = false;
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

  /**
   * 绘制分组角标（左上角半透明标签）
   * 仅在该分组的第一张图片上绘制
   */
  private _drawGroupBadge(ctx: CanvasRenderingContext2D, zoom: number): void {
    if (!this._isFirstInGroup || !this._groupLabel) return;

    const invZoom = 1 / zoom;
    const text = this._groupLabel;

    ctx.save();

    // 在反向缩放坐标系中绘制，保持文字大小恒定
    const offsetX = GROUP_BADGE_OFFSET * invZoom;
    const offsetY = GROUP_BADGE_OFFSET * invZoom;
    ctx.translate(offsetX, offsetY);
    ctx.scale(invZoom, invZoom);

    // 使用 measureText 获取实际文字宽度（含中文字符）
    ctx.font = GROUP_BADGE_FONT;
    const textWidth = ctx.measureText(text).width;
    const bgWidth = textWidth + GROUP_BADGE_PADDING_X * 2;
    const bgHeight = 10 + GROUP_BADGE_PADDING_Y * 2; // 10px font size

    // 绘制圆角矩形背景
    const r = GROUP_BADGE_RADIUS;
    ctx.fillStyle = GROUP_BADGE_BG;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(bgWidth - r, 0);
    ctx.arcTo(bgWidth, 0, bgWidth, r, r);
    ctx.lineTo(bgWidth, bgHeight - r);
    ctx.arcTo(bgWidth, bgHeight, bgWidth - r, bgHeight, r);
    ctx.lineTo(r, bgHeight);
    ctx.arcTo(0, bgHeight, 0, bgHeight - r, r);
    ctx.lineTo(0, r);
    ctx.arcTo(0, 0, r, 0, r);
    ctx.closePath();
    ctx.fill();

    // 绘制文字（font 已在 measureText 前设置）
    ctx.fillStyle = GROUP_BADGE_TEXT_COLOR;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, GROUP_BADGE_PADDING_X, bgHeight / 2);

    ctx.restore();
  }

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
   * 绘制悬停效果：图片外围 1.5px 淡白描边（带轻阴影）
   * 使用反向缩放保证边框屏幕像素宽度恒定，不随 zoom 变化
   * 仅当 hoverAnimValue > 0 且未选中时调用
   */
  private _drawHover(ctx: CanvasRenderingContext2D, zoom: number): void {
    const alpha = this.hoverAnimValue * this.alpha;
    if (alpha <= 0.01) return;

    const invZoom = 1 / zoom;
    const borderW = HOVER_BORDER_WIDTH * invZoom;
    const half = borderW / 2;

    ctx.save();
    ctx.globalAlpha = alpha;

    // 轻阴影增强在复杂底色上的辨识度
    ctx.shadowColor = HOVER_BORDER_SHADOW;
    ctx.shadowBlur = 3 * invZoom;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = HOVER_BORDER_COLOR;
    ctx.lineWidth = borderW;
    ctx.strokeRect(half, half, this.width - borderW, this.height - borderW);

    ctx.restore();
  }

  /**
   * 绘制选中效果：内缩品牌色边框 + 右上角精致角标
   * 使用反向缩放保证边框和角标在任意 zoom 下像素大小恒定
   */
  private _drawSelection(ctx: CanvasRenderingContext2D, zoom: number): void {
    const now = performance.now();
    const elapsed = now - this.selectionAnimStartTime;
    const duration = getSelAnimDuration();

    let progress = Math.min(elapsed / duration, 1);
    if (this.selectionAnimDirection === 'out') {
      // 退出动画 75% 时长（比进入稍快）
      const outDuration = duration * 0.75;
      progress = Math.min(elapsed / outDuration, 1);
      progress = 1 - progress;
    }

    // ease-out-quart 缓动，工具感更强、更自然的减速
    const eased = easeOutQuart(progress);
    const baseAlpha = this.alpha;
    const invZoom = 1 / zoom;

    ctx.save();
    ctx.globalAlpha = baseAlpha * eased;

    // ─── 内缩边框（恒定屏幕像素宽度）───
    const borderW = SELECTION_BORDER_WIDTH * invZoom;
    const halfBorder = borderW / 2;
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = borderW;
    ctx.strokeRect(halfBorder, halfBorder, this.width - borderW, this.height - borderW);

    // ─── 右上角圆形角标 + 对勾 ───
    // 切换到屏幕像素坐标绘制，保证大小恒定
    const badgeR = SELECTION_BADGE_RADIUS;
    const offset = SELECTION_BADGE_OFFSET;
    // 角标中心（内容坐标）
    const badgeCx = this.width - (offset + badgeR) * invZoom;
    const badgeCy = (offset + badgeR) * invZoom;

    // 阴影（提升在亮/暗图片上的辨识度）
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 4 * invZoom;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1 * invZoom;

    // 品牌色圆形背景
    ctx.fillStyle = SELECTION_COLOR;
    ctx.beginPath();
    ctx.arc(badgeCx, badgeCy, badgeR * invZoom, 0, Math.PI * 2);
    ctx.fill();

    // 关闭阴影，绘制白色对勾
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    const r = badgeR * invZoom; // 角标半径（内容坐标）
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(1, 1.8 * invZoom);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(badgeCx - r * 0.35, badgeCy + r * 0.02);
    ctx.lineTo(badgeCx - r * 0.05, badgeCy + r * 0.32);
    ctx.lineTo(badgeCx + r * 0.38, badgeCy - r * 0.30);
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
      : getSelAnimDuration() * 0.75;

    return elapsed < duration;
  }

  /**
   * 更新悬停动画进度，返回是否需要继续渲染
   * 同时写入 this.hoverAnimValue（0-1）供 _drawHover 使用
   */
  private _updateHoverAnimation(now: number): boolean {
    const duration = this.hoverAnimDirection === 'in'
      ? getHoverAnimDuration()
      : getHoverAnimDuration() * 0.75;

    // duration 为 0（reduced-motion）时直接取终值
    if (duration <= 0) {
      this.hoverAnimValue = this._isHovered ? 1 : 0;
      return false;
    }

    const elapsed = now - this.hoverAnimStartTime;
    const rawProgress = Math.max(0, Math.min(1, elapsed / duration));
    const eased = easeOutQuart(rawProgress);
    this.hoverAnimValue = this.hoverAnimDirection === 'in' ? eased : 1 - eased;

    return rawProgress < 1;
  }

  /** 格式化拍摄参数为显示字符串 */
  private static _formatParams(meta?: ImageMetadata | null): string {
    if (!meta) return '';
    const parts: string[] = [];

    if (meta.fNumber != null) parts.push(`f/${meta.fNumber}`);
    if (meta.exposureTime != null) parts.push(`${meta.exposureTime}s`);
    if (meta.isoSpeed != null) parts.push(`ISO ${meta.isoSpeed}`);
    if (meta.focalLength35mm != null && meta.focalLength35mm !== meta.focalLength) {
      parts.push(`${meta.focalLength35mm}mm`);
    } else if (meta.focalLength != null) {
      parts.push(`${meta.focalLength}mm`);
    }
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
