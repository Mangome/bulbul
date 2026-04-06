// ============================================================
// Canvas 2D 画布图片项
//
// 纯 Canvas 2D 实现，替代 PixiJS Container。
// 包含：
// - 占位色块（图片加载前）
// - 图片绘制（应用 EXIF Orientation 变换）
// - 选中/悬停视觉效果
// - 信息覆盖层（底部渐变 + Badge）
// - AABB 命中检测
// ============================================================

import type { LayoutItem } from '../../utils/layout';
import type { ImageMetadata, DetectionBox } from '../../types';
import { drawDetectionOverlay } from './drawDetectionOverlay';

// ─── 常量 ─────────────────────────────────────────────

/** 占位色块颜色 */
const PLACEHOLDER_COLOR = '#E0E4EB';
/** 信息覆盖层可见的最低缩放级别 */
const INFO_OVERLAY_MIN_ZOOM = 0.3;
/** 信息覆盖层从开始淡入到完全可见的缩放区间宽度 */
const INFO_OVERLAY_FADE_RANGE = 0.1;

/** 选中色（品牌靛蓝，在画布背景上辨识度高） */
const SELECTION_COLOR = '#2563A8';
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

// Badge 样式常量（屏幕像素，不随缩放变化）
const BADGE_PADDING_X = 6;
const BADGE_PADDING_Y = 3;
const BADGE_RADIUS = 8;
const BADGE_GAP = 4;
const ROW_GAP = 3;
const LEFT_PADDING = 8;
const VERTICAL_PADDING = 8;

const FILE_NAME_FONT_SIZE = 11;
const PARAM_FONT_SIZE = 10;

/** 合焦评分星级颜色 */
const FOCUS_SCORE_COLORS: Record<number, string> = {
  5: '#4CAF50',  // 绿色
  4: '#2196F3',  // 蓝色
  3: '#FF9800',  // 橙色
  2: '#F44336',  // 红色
  1: '#F44336',  // 红色
};

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
  private fileName: string = '';
  private metadata: ImageMetadata | null = null;

  // 视觉状态
  alpha: number = 1;
  private _isSelected: boolean = false;
  private _isHovered: boolean = false;

  // 选中动画状态
  private selectionAnimStartTime: number = 0;
  private selectionAnimDirection: 'in' | 'out' = 'in';

  // 检测框
  private detectionBoxes: DetectionBox[] = [];
  private detectionVisible: boolean = false;

  // 重新加载标志：图片被 LRU 淘汰后需要重新加载
  needsReload: boolean = false;

  // Badge 布局缓存
  private badgeLayoutCache: BadgeLayoutCache | null = null;
  private lastCachedZoom: number = 0;


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

  /**
   * 设置图片信息（文件名 + 拍摄参数）
   * 预计算 Badge 布局数据并缓存
   */
  setImageInfo(fileName: string, metadata?: ImageMetadata | null): void {
    this.fileName = fileName;
    this.metadata = metadata ?? null;
    // 清除 Badge 缓存，强制在下次 draw 中重新计算
    this.badgeLayoutCache = null;
    this.lastCachedZoom = 0;
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

    // 绘制检测框覆盖层
    if (this.detectionVisible && this.detectionBoxes.length > 0) {
      drawDetectionOverlay(ctx, this.detectionBoxes, this.width, this.height);
    }

    // 计算信息覆盖层的 alpha
    const infoOverlayAlpha = this._calculateInfoOverlayAlpha(zoom);

    // 绘制信息覆盖层
    if (infoOverlayAlpha > 0) {
      ctx.save();
      ctx.globalAlpha *= infoOverlayAlpha;
      this._drawInfoOverlay(ctx, zoom);
      ctx.restore();
    }

    // 绘制悬停/选中效果
    if (this._isSelected) {
      // 更新选中动画状态
      const animNeedsFrame = this._updateSelectionAnimation(now);
      needsNextFrame = needsNextFrame || animNeedsFrame;

      // 绘制选中效果
      this._drawSelection(ctx);
    } else if (this._isHovered) {
      // 绘制悬停效果
      this._drawHover(ctx);
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
      // 启动选中渐入动画
      this.selectionAnimStartTime = performance.now();
      this.selectionAnimDirection = 'in';
    } else {
      // 启动选中渐出动画
      this.selectionAnimStartTime = performance.now();
      this.selectionAnimDirection = 'out';
    }
  }

  /**
   * 设置悬停状态
   */
  setHovered(hovered: boolean): void {
    this._isHovered = hovered && !this._isSelected;
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

  /**
   * 更新信息覆盖层可见性（低缩放时淡出，平滑过渡；文字大小不随缩放变化）
   */
  updateZoomVisibility(zoomLevel: number): void {
    // 清除 Badge 缓存，强制重新布局（缩放变化时字数上限会变化）
    if (Math.abs(zoomLevel - this.lastCachedZoom) > 0.01) {
      this.badgeLayoutCache = null;
    }
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
    this.metadata = null;
    this.badgeLayoutCache = null;
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
   * 绘制信息覆盖层（渐变背景 + 文件名 + Badge）
   */
  private _drawInfoOverlay(ctx: CanvasRenderingContext2D, zoom: number): void {
    ctx.save();

    const s = 1 / zoom; // 反向缩放因子
    const z = zoom;

    // 1. 计算覆盖层高度
    const { totalContentH, overlayHeight, overlayY } = this._calculateOverlayLayout(zoom);

    // 2. 绘制渐变背景
    const gradient = ctx.createLinearGradient(0, overlayY, 0, overlayY + overlayHeight);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, overlayY, this.width, overlayHeight);

    // 3. 文字内容（反向缩放）
    ctx.scale(s, s);

    const bottomY = this.height * z; // 图片底边在容器坐标中的位置
    const contentBottomY = bottomY - VERTICAL_PADDING;
    const startY = contentBottomY - totalContentH;

    // 文件名
    if (this.fileName) {
      ctx.font = `600 ${FILE_NAME_FONT_SIZE}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.textBaseline = 'top';
      const maxChars = maxCharsForWidth(this.width, zoom);
      const displayName = truncateFileName(this.fileName, maxChars);
      ctx.fillText(displayName, LEFT_PADDING * z, startY);
    }

    // Badge 行
    if (this.metadata) {
      const badgeLayout = this._getBadgeLayout(zoom);
      const badgeY = startY + badgeLayout.nameH + (badgeLayout.badges.length > 0 ? ROW_GAP : 0);

      let offsetX = LEFT_PADDING * z;
      for (const badge of badgeLayout.badges) {
        this._drawBadge(ctx, offsetX, badgeY, badge);
        offsetX += badge.width + BADGE_GAP;
      }
    }

    ctx.restore();
  }

  /**
   * 绘制选中效果（叠加层 + 边框 + CheckMark）
   */
  private _drawSelection(ctx: CanvasRenderingContext2D): void {
    const now = performance.now();
    const elapsed = now - this.selectionAnimStartTime;
    const duration = CanvasImageItem._getSelAnimDuration();

    let progress = Math.min(elapsed / duration, 1);
    if (this.selectionAnimDirection === 'out') {
      const outDuration = duration * 0.6;
      progress = Math.min(elapsed / outDuration, 1);
      progress = 1 - progress;
    }

    ctx.save();

    // 绘制叠加层
    ctx.globalAlpha *= progress * SELECTION_OVERLAY_ALPHA;
    ctx.fillStyle = SELECTION_COLOR;
    ctx.fillRect(0, 0, this.width, this.height);

    // 绘制内侧描边
    ctx.globalAlpha = progress * 0.15;
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, this.width, this.height);

    // 绘制外发光
    ctx.globalAlpha = progress * SELECTION_GLOW_ALPHA;
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 3;
    const glowExtend = 6;
    ctx.strokeRect(-glowExtend, -glowExtend, this.width + glowExtend * 2, this.height + glowExtend * 2);

    // 绘制实色边框
    ctx.globalAlpha = progress;
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = SELECTION_BORDER_WIDTH;
    ctx.strokeRect(-SELECTION_BORDER_WIDTH / 2, -SELECTION_BORDER_WIDTH / 2, this.width + SELECTION_BORDER_WIDTH, this.height + SELECTION_BORDER_WIDTH);

    // 绘制 CheckMark
    const cx = this.width - CHECK_OFFSET - CHECK_RADIUS;
    const cy = CHECK_OFFSET + CHECK_RADIUS;
    const checkProgress = progress < 1
      ? 1 - Math.pow(1 - progress, 3) * Math.cos(progress * Math.PI * 0.5)
      : 1;
    const checkScale = checkProgress;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(checkScale, checkScale);
    ctx.translate(-cx, -cy);

    // 白色外环
    ctx.globalAlpha = progress * 0.9;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx, cy, CHECK_RADIUS + 2, 0, Math.PI * 2);
    ctx.fill();

    // 品牌色圆形
    ctx.globalAlpha = progress;
    ctx.fillStyle = SELECTION_COLOR;
    ctx.beginPath();
    ctx.arc(cx, cy, CHECK_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // 白色对勾
    ctx.globalAlpha = progress;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy);
    ctx.lineTo(cx - 1.5, cy + 4);
    ctx.lineTo(cx + 6, cy - 5);
    ctx.stroke();

    ctx.restore();
    ctx.restore();
  }

  /**
   * 绘制悬停效果（边框）
   */
  private _drawHover(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // 绘制外发光
    ctx.globalAlpha *= 0.2;
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 3;
    const glowExtend = 4;
    ctx.strokeRect(-glowExtend, -glowExtend, this.width + glowExtend * 2, this.height + glowExtend * 2);

    // 绘制悬停边框
    ctx.globalAlpha = 1;
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = HOVER_BORDER_WIDTH;
    ctx.strokeRect(-HOVER_BORDER_WIDTH / 2, -HOVER_BORDER_WIDTH / 2, this.width + HOVER_BORDER_WIDTH, this.height + HOVER_BORDER_WIDTH);

    ctx.restore();
  }

  /**
   * 绘制单个 Badge
   */
  private _drawBadge(ctx: CanvasRenderingContext2D, x: number, y: number, badge: BadgeInfo): void {
    ctx.save();

    ctx.fillStyle = badge.bgColor;
    ctx.globalAlpha = badge.bgAlpha;

    // 绘制圆角矩形背景
    this._roundRect(ctx, x, y, badge.width, badge.height, BADGE_RADIUS);
    ctx.fill();

    // 绘制文字
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `${PARAM_FONT_SIZE}px system-ui, -apple-system, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(badge.text, x + BADGE_PADDING_X, y + BADGE_PADDING_Y);

    ctx.restore();
  }

  /**
   * 绘制圆角矩形路径
   */
  private _roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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

  // ── 私有方法：动画和计算 ────────────────────────────────────────

  /** 获取选中动画时长（ms）— 尊重 prefers-reduced-motion */
  private static _getSelAnimDuration(): number {
    if (typeof window === 'undefined') return 200;
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    return prefersReduced ? 0 : 200;
  }

  /**
   * 更新选中动画状态
   * @returns 是否需要继续渲染
   */
  private _updateSelectionAnimation(now: number): boolean {
    const elapsed = now - this.selectionAnimStartTime;
    const duration = this.selectionAnimDirection === 'in'
      ? CanvasImageItem._getSelAnimDuration()
      : CanvasImageItem._getSelAnimDuration() * 0.6;

    // 动画还在进行中，需要下一帧
    return elapsed < duration;
  }

  /**
   * 计算信息覆盖层的透明度
   */
  private _calculateInfoOverlayAlpha(zoom: number): number {
    if (zoom < INFO_OVERLAY_MIN_ZOOM) {
      return 0;
    }
    if (zoom < INFO_OVERLAY_MIN_ZOOM + INFO_OVERLAY_FADE_RANGE) {
      return (zoom - INFO_OVERLAY_MIN_ZOOM) / INFO_OVERLAY_FADE_RANGE;
    }
    return 1;
  }

  /**
   * 计算覆盖层布局
   */
  private _calculateOverlayLayout(zoom: number): { totalContentH: number; overlayHeight: number; overlayY: number } {
    const badgeLayout = this._getBadgeLayout(zoom);
    const nameH = badgeLayout.nameH;
    const badgeH = badgeLayout.badges.length > 0 ? badgeLayout.badgeH : 0;
    const gap = badgeLayout.badges.length > 0 ? ROW_GAP : 0;
    const totalContentH = nameH + gap + badgeH; // 屏幕像素

    const s = 1 / zoom; // 反向缩放因子
    const overlayScreenH = totalContentH + VERTICAL_PADDING * 2;
    const overlayHeight = overlayScreenH * s; // 内容坐标
    const overlayY = this.height - overlayHeight;

    return { totalContentH, overlayHeight, overlayY };
  }

  /**
   * 获取或计算 Badge 布局
   */
  private _getBadgeLayout(zoom: number): BadgeLayout {
    // 检查缓存是否有效
    if (this.badgeLayoutCache && Math.abs(zoom - this.lastCachedZoom) < 0.01) {
      return this.badgeLayoutCache;
    }

    // 测量文件名高度
    const testCanvas = document.createElement('canvas');
    const testCtx = testCanvas.getContext('2d')!;
    testCtx.font = `600 ${FILE_NAME_FONT_SIZE}px system-ui, -apple-system, sans-serif`;
    const nameMetrics = testCtx.measureText(this.fileName || 'A');
    const nameH = nameMetrics.actualBoundingBoxAscent + nameMetrics.actualBoundingBoxDescent;

    // 构建 Badge 列表
    const badges: BadgeInfo[] = [];
    if (this.metadata) {
      const badgeTexts = buildParamBadges(this.metadata);
      const maxX = (this.width - LEFT_PADDING) * zoom;
      let testX = LEFT_PADDING * zoom;

      testCtx.font = `${PARAM_FONT_SIZE}px system-ui, -apple-system, sans-serif`;

      for (const text of badgeTexts) {
        const textMetrics = testCtx.measureText(text);
        const badgeW = textMetrics.width + BADGE_PADDING_X * 2;
        const badgeH = PARAM_FONT_SIZE + BADGE_PADDING_Y * 2;

        testX += badgeW + BADGE_GAP;
        if (testX - BADGE_GAP > maxX) {
          break;
        }

        badges.push({
          text,
          width: badgeW,
          height: badgeH,
          bgColor: '#000000',
          bgAlpha: 0.5,
        });
      }

      // 合焦评分 Badge
      if (this.metadata.focusScoreMethod === 'Undetected') {
        const undetectedBadge = this._createUndetectedBadge(testCtx);
        testX += undetectedBadge.width + BADGE_GAP;
        if (testX - BADGE_GAP <= maxX) {
          badges.push(undetectedBadge);
        }
      } else if (this.metadata.focusScore != null) {
        const focusBadge = this._createFocusScoreBadge(this.metadata.focusScore, testCtx);
        testX += focusBadge.width + BADGE_GAP;
        if (testX - BADGE_GAP <= maxX) {
          badges.push(focusBadge);
        }
      }
    }

    const badgeH = badges.length > 0
      ? PARAM_FONT_SIZE + BADGE_PADDING_Y * 2
      : 0;

    const layout: BadgeLayout = {
      nameH,
      badgeH,
      badges,
    };

    // 缓存
    this.badgeLayoutCache = layout;
    this.lastCachedZoom = zoom;

    return layout;
  }

  /**
   * 创建合焦评分 Badge
   */
  private _createFocusScoreBadge(score: number, ctx: CanvasRenderingContext2D): BadgeInfo {
    const stars = '\u2605'.repeat(score) + '\u2606'.repeat(5 - score);
    const bgColor = FOCUS_SCORE_COLORS[score] ?? '#666666';

    ctx.font = `${PARAM_FONT_SIZE}px system-ui, -apple-system, sans-serif`;
    const metrics = ctx.measureText(stars);
    const width = metrics.width + BADGE_PADDING_X * 2;
    const height = PARAM_FONT_SIZE + BADGE_PADDING_Y * 2;

    return {
      text: stars,
      width,
      height,
      bgColor,
      bgAlpha: 0.75,
    };
  }

  /**
   * 创建"未检测到主体" Badge
   */
  private _createUndetectedBadge(ctx: CanvasRenderingContext2D): BadgeInfo {
    const text = '未检测到主体';
    ctx.font = `${PARAM_FONT_SIZE}px system-ui, -apple-system, sans-serif`;
    const metrics = ctx.measureText(text);
    const width = metrics.width + BADGE_PADDING_X * 2;
    const height = PARAM_FONT_SIZE + BADGE_PADDING_Y * 2;

    return {
      text,
      width,
      height,
      bgColor: '#999999',
      bgAlpha: 0.75,
    };
  }
}

// ─── 辅助函数 ─────────────────────────────────────────

/**
 * 从 ImageMetadata 构建拍摄参数标签
 */
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

// ─── 类型定义 ─────────────────────────────────────────

interface BadgeInfo {
  text: string;
  width: number;
  height: number;
  bgColor: string;
  bgAlpha: number;
}

interface BadgeLayout {
  nameH: number;
  badgeH: number;
  badges: BadgeInfo[];
}

interface BadgeLayoutCache {
  nameH: number;
  badgeH: number;
  badges: BadgeInfo[];
}
