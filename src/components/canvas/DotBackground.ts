// ============================================================
// 波点底纹背景
//
// 使用 OffscreenCanvas 生成波点 tile，通过 CanvasPattern 实现
// 无限重复。固定在视口坐标系，不受 ContentLayer 缩放影响。
// ============================================================

// ─── 配置 ─────────────────────────────────────────────

/** 波点间距（单位 px） */
const DOT_SPACING = 40;
/** 波点半径（单位 px） */
const DOT_RADIUS = 1.0;
/** 亮色主题波点颜色 */
const DOT_COLOR_LIGHT = '#E0E4EB';
/** 暗色主题波点颜色 */
const DOT_COLOR_DARK = '#232D40';
/** 波点透明度 */
const DOT_ALPHA = 0.5;

// ─── DotBackground ───────────────────────────────────

export class DotBackground {
  private pattern: CanvasPattern | null = null;
  private currentTheme: 'light' | 'dark' | null = null;

  /**
   * 更新主题并重建 CanvasPattern。
   * 相同主题不重复生成。
   */
  updateTheme(theme: 'light' | 'dark', ctx: CanvasRenderingContext2D): void {
    if (theme === this.currentTheme && this.pattern) return;
    this.currentTheme = theme;

    const size = DOT_SPACING;
    const offscreen = new OffscreenCanvas(size, size);
    const octx = offscreen.getContext('2d')!;
    octx.clearRect(0, 0, size, size);
    octx.fillStyle = theme === 'light' ? DOT_COLOR_LIGHT : DOT_COLOR_DARK;
    octx.globalAlpha = DOT_ALPHA;
    octx.beginPath();
    octx.arc(size / 2, size / 2, DOT_RADIUS, 0, Math.PI * 2);
    octx.fill();

    this.pattern = ctx.createPattern(offscreen, 'repeat');
  }

  /**
   * 绘制波点背景，铺满指定区域。
   * pattern 未初始化时跳过。
   */
  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (!this.pattern) return;
    ctx.fillStyle = this.pattern;
    ctx.fillRect(0, 0, width, height);
  }

  /** 清理资源 */
  destroy(): void {
    this.pattern = null;
    this.currentTheme = null;
  }
}
