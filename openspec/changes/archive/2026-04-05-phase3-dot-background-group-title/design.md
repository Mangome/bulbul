## Context

当前 `DotBackground.ts` (117行) 继承 PixiJS `Container`，使用 `Graphics` 生成波点纹理后通过 `TilingSprite` 铺满视口。`GroupTitle.ts` (49行) 继承 PixiJS `Container`，使用 PixiJS `Text` 对象渲染分组标题。两者 PixiJS 耦合度均为 10/10。

Phase 5 InfiniteCanvas 重写需要这两个组件提供纯 Canvas 2D 绘制接口，本 Phase 作为前置依赖独立完成。

## Goals / Non-Goals

**Goals:**
- 将 DotBackground 从 PixiJS TilingSprite 改为 Canvas 2D CanvasPattern，公共 API 为 `draw(ctx, width, height)` 和 `updateTheme(theme)`
- 将 GroupTitle 从 PixiJS Text 改为纯函数 `drawGroupTitles(ctx, titles, zoom)`，无类实例
- 保持波点视觉效果与现有一致（间距/颜色/透明度参数不变）
- 保持分组标题文字样式与现有一致

**Non-Goals:**
- 不改造 InfiniteCanvas 渲染循环（Phase 5 范围）
- 不优化波点渲染性能（CanvasPattern 已是最优方案）
- 不添加新的视觉效果或动画

## Decisions

### 1. DotBackground 使用 OffscreenCanvas + CanvasPattern

**选择**: 生成一个 40×40 的 OffscreenCanvas 作为 pattern tile，通过 `ctx.createPattern(offscreen, 'repeat')` 创建可复用 pattern。

**替代方案**: 每帧遍历可见区域逐个绘制波点。

**理由**: CanvasPattern 由浏览器原生处理重复，单次 `fillRect` 即可铺满任意尺寸视口，性能最优且代码最简。OffscreenCanvas 在 Tauri Chromium WebView 中完全支持。

### 2. DotBackground 不再继承 Container

**选择**: 独立类，构造函数不接收外部依赖，`updateTheme()` 接收绘制用的 `CanvasRenderingContext2D` 来创建 pattern。

**理由**: 无 PixiJS 场景图后无需 Container 继承。pattern 创建需要 ctx（因为 `createPattern` 是 ctx 的方法），所以在 `updateTheme` 或初始化时传入。

### 3. GroupTitle 改为纯函数而非类

**选择**: 导出 `drawGroupTitles(ctx, titles, zoom)` 函数，由 InfiniteCanvas 渲染循环在内容层变换后调用。

**替代方案**: 保留 GroupTitle 类封装。

**理由**: 分组标题只需一次 `fillText` 调用，无内部状态需要管理，类封装是过度设计。纯函数更易测试和复用。

### 4. 文本截断使用字符估算而非 measureText

**选择**: 保持现有的字符宽度估算方式（~10px/字符），超出时截断加 `...`。

**替代方案**: 使用 `ctx.measureText()` 精确测量。

**理由**: 分组标题通常较短（"分组 1（5 张）"），估算已足够准确。避免每帧调用 measureText 的开销。

## Risks / Trade-offs

- **OffscreenCanvas 兼容性** → Tauri 使用 Chromium WebView，完全支持 OffscreenCanvas，无风险
- **Pattern 创建依赖 ctx** → 需要在 canvas 初始化后才能创建 pattern，通过延迟初始化（首次 draw 时检查）解决
- **文本截断精度** → 字符估算对中英文混排可能不够精确 → 当前标题格式固定（"分组 N（M 张）"），估算足够
