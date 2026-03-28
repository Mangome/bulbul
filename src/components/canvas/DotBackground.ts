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

/** 波点间距 */
const DOT_SPACING = 24;
/** 波点半径 */
const DOT_RADIUS = 1.5;
/** 波点颜色 */
const DOT_COLOR = 0xD8D8D8;
/** 波点透明度 */
const DOT_ALPHA = 0.6;

// ─── DotBackground ───────────────────────────────────

export class DotBackground extends Container {
  private tilingSprite: TilingSprite | null = null;

  /**
   * 初始化波点底纹
   *
   * 生成一个 tile 大小的纹理，然后用 TilingSprite 铺满视口。
   */
  async init(app: Application): Promise<void> {
    const tileSize = DOT_SPACING;

    // 生成波点纹理
    const dotGraphics = new Graphics();

    // 均匀的单点模式（tile 中心）
    dotGraphics
      .circle(tileSize / 2, tileSize / 2, DOT_RADIUS)
      .fill({ color: DOT_COLOR, alpha: DOT_ALPHA });

    // 生成纹理
    const texture = (app.renderer as Renderer).generateTexture(dotGraphics);
    dotGraphics.destroy();

    // 创建 TilingSprite
    this.tilingSprite = new TilingSprite({
      texture,
      width: app.screen.width,
      height: app.screen.height,
    });

    this.addChild(this.tilingSprite);
  }

  /** 窗口 resize 时更新 TilingSprite 尺寸 */
  resize(width: number, height: number): void {
    if (!this.tilingSprite) return;
    this.tilingSprite.width = width;
    this.tilingSprite.height = height;
  }
}
