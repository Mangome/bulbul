## Why

Canvas 2D 重构 Phase 3：将波点背景（DotBackground）和分组标题（GroupTitle）从 PixiJS 迁移到原生 Canvas 2D API。当前实现完全依赖 PixiJS 的 Container、TilingSprite、Graphics、Text 等对象，是 Phase 5 InfiniteCanvas 重写的前置依赖。

## What Changes

- **重写 `DotBackground.ts`**：移除 PixiJS Container/TilingSprite/Graphics 继承，改用 OffscreenCanvas 生成 CanvasPattern，每帧仅调用一次 `ctx.fillRect()` 铺满视口
- **重写 `GroupTitle.ts`**：移除 PixiJS Container/Text 依赖，改为纯函数式 Canvas 2D 绘制（`ctx.fillText()`），由 InfiniteCanvas 渲染循环直接调用
- **更新波点参数**：对齐重构计划中的精确参数（间距 40px、半径 1.0px、亮/暗主题颜色、alpha 0.5），简化旧 spec 中的双波点设计为单波点
- **暗色主题支持**：波点背景显式支持 `light` / `dark` 两套颜色方案

## Capabilities

### New Capabilities

- `canvas2d-dot-background`: 使用 Canvas 2D CanvasPattern 实现的波点背景渲染，替代 PixiJS TilingSprite 方案
- `canvas2d-group-title`: 使用 Canvas 2D fillText 实现的分组标题绘制，替代 PixiJS Text 对象方案

### Modified Capabilities

- `dot-background`: 渲染技术从 PixiJS TilingSprite 变更为 Canvas 2D CanvasPattern，波点参数简化为单波点设计

## Impact

- **改动文件**：`src/components/canvas/DotBackground.ts`（重写）、`src/components/canvas/GroupTitle.ts`（重写）
- **依赖变化**：两个文件完全移除 `pixi.js` 导入
- **接口变化**：DotBackground 不再继承 Container，改为独立类；GroupTitle 不再继承 Container，改为纯绘制函数
- **下游影响**：Phase 5 InfiniteCanvas 重写时将直接调用新接口
