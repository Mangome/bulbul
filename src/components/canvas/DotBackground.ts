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
const DOT_SPACING = 20;
/** 主波点半径 */
const MAIN_DOT_RADIUS = 3;
/** 主波点颜色 */
const MAIN_DOT_COLOR = 0xE1E1E1;
/** 主波点透明度 */
const MAIN_DOT_ALPHA = 0.47;
/** 小波点半径 */
const SMALL_DOT_RADIUS = 2;
/** 小波点颜色 */
const SMALL_DOT_COLOR = 0xC8C8C8;
/** 小波点透明度 */
const SMALL_DOT_ALPHA = 0.31;

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

    // 主波点（tile 中心）
    dotGraphics
      .circle(tileSize / 2, tileSize / 2, MAIN_DOT_RADIUS)
      .fill({ color: MAIN_DOT_COLOR, alpha: MAIN_DOT_ALPHA });

    // 小波点（tile 左上角，与相邻 tile 的小波点组成交错图案）
    dotGraphics
      .circle(0, 0, SMALL_DOT_RADIUS)
      .fill({ color: SMALL_DOT_COLOR, alpha: SMALL_DOT_ALPHA });

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
