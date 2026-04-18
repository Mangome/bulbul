// ============================================================
// 波点底纹背景
//
// 使用 OffscreenCanvas 生成波点 tile，通过 CanvasPattern 实现
// 无限重复。固定在视口坐标系，不受 ContentLayer 缩放影响。
//
// 支持主题切换交叉淡入：保留旧 pattern 并以 alpha 渐变过渡到新 pattern。
// ============================================================

// ─── 配置 ─────────────────────────────────────────────

/** 波点间距（单位 px） */
const DOT_SPACING = 40;
/** 波点半径（单位 px） */
const DOT_RADIUS = 1.0;
/** 亮色主题波点颜色 */
const DOT_COLOR_LIGHT = '#D2D2D7';
/** 暗色主题波点颜色 */
const DOT_COLOR_DARK = '#38383A';
/** 波点透明度 */
const DOT_ALPHA = 0.5;

// ─── DotBackground ───────────────────────────────────

export class DotBackground {
  private pattern: CanvasPattern | null = null;
  private previousPattern: CanvasPattern | null = null;
  private currentTheme: 'light' | 'dark' | null = null;

  /**
   * 更新主题并重建 CanvasPattern。
   * 相同主题不重复生成。
   * 若已有 pattern，会保留为 previousPattern，用于交叉淡入。
   */
  updateTheme(theme: 'light' | 'dark', ctx: CanvasRenderingContext2D): void {
    if (theme === this.currentTheme && this.pattern) return;

    // 保留旧 pattern 以支持交叉淡入
    this.previousPattern = this.pattern;
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
   * 清除保留的旧 pattern（主题过渡动画结束后调用）
   */
  clearPrevious(): void {
    this.previousPattern = null;
  }

  /**
   * 绘制波点背景，铺满指定区域。
   *
   * @param transitionProgress 主题过渡进度（0-1），1 表示完全显示新主题
   *                           小于 1 时以 previousPattern + 新 pattern 交叉淡入
   */
  draw(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    transitionProgress: number = 1,
  ): void {
    if (!this.pattern) return;

    // 正常渲染：仅绘制当前 pattern
    if (transitionProgress >= 1 || !this.previousPattern) {
      ctx.fillStyle = this.pattern;
      ctx.fillRect(0, 0, width, height);
      return;
    }

    // 过渡中：旧 pattern 向下淡出，新 pattern 向上淡入
    const prevSave = ctx.globalAlpha;
    ctx.globalAlpha = prevSave * (1 - transitionProgress);
    ctx.fillStyle = this.previousPattern;
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = prevSave * transitionProgress;
    ctx.fillStyle = this.pattern;
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = prevSave;
  }

  /** 清理资源 */
  destroy(): void {
    this.pattern = null;
    this.previousPattern = null;
    this.currentTheme = null;
  }
}
