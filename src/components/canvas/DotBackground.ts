// ============================================================
// 波点底纹背景
//
// 使用 PixiJS Graphics 生成波点纹理，通过 TilingSprite 实现
// 无限重复。固定在视口坐标系，不受 ContentLayer 缩放影响。
// ============================================================

import {
  Container,
  Graphics,
  TilingSprite,
  type Application,
  type Renderer,
} from 'pixi.js';

// ─── 配置 ─────────────────────────────────────────────

/** 波点间距（单位 px） */
const DOT_SPACING = 40;
/** 波点半径（单位 px） */
const DOT_RADIUS = 1.0;
/** 亮色主题波点颜色 */
const DOT_COLOR_LIGHT = 0xE0E0E0;
/** 暗色主题波点颜色 */
const DOT_COLOR_DARK = 0x4A4A4A;
/** 波点透明度 */
const DOT_ALPHA = 0.5;

// ─── DotBackground ───────────────────────────────────

export class DotBackground extends Container {
  private tilingSprite: TilingSprite | null = null;
  private app: Application | null = null;

  /**
   * 初始化波点底纹
   *
   * 生成一个 tile 大小的纹理，然后用 TilingSprite 铺满视口。
   */
  async init(app: Application): Promise<void> {
    this.app = app;
    this.renderDots('light');
  }

  /**
   * 根据主题重新渲染波点
   */
  private renderDots(theme: 'light' | 'dark'): void {
    if (!this.app) return;

    // 清理旧的 TilingSprite
    if (this.tilingSprite) {
      this.removeChild(this.tilingSprite);
      this.tilingSprite.destroy({ texture: true });
    }

    const tileSize = DOT_SPACING;
    const dotColor = theme === 'light' ? DOT_COLOR_LIGHT : DOT_COLOR_DARK;

    // 生成波点纹理
    const dotGraphics = new Graphics();
    dotGraphics
      .circle(tileSize / 2, tileSize / 2, DOT_RADIUS)
      .fill({ color: dotColor, alpha: DOT_ALPHA });

    // 生成纹理
    const texture = (this.app.renderer as Renderer).generateTexture(dotGraphics);
    dotGraphics.destroy();

    // 创建 TilingSprite
    this.tilingSprite = new TilingSprite({
      texture,
      width: this.app.screen.width,
      height: this.app.screen.height,
    });

    this.addChild(this.tilingSprite);
  }

  /**
   * 更新主题
   */
  updateTheme(theme: 'light' | 'dark'): void {
    this.renderDots(theme);
  }

  /** 窗口 resize 时更新 TilingSprite 尺寸 */
  resize(width: number, height: number): void {
    if (!this.tilingSprite) return;
    this.tilingSprite.width = width;
    this.tilingSprite.height = height;
  }
}
