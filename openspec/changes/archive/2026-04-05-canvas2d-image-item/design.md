## Context

Bulbul 使用 PixiJS v8 作为画布渲染引擎，`CanvasImageItem` 作为 `Container` 子类封装单张图片的全部视觉效果。快速切组时，纹理生命周期竞态导致 `Cannot read properties of null` 崩溃。整体迁移计划分 6 个 Phase，本次聚焦 Phase 2：将 `CanvasImageItem` 从 PixiJS 对象树重写为 Canvas 2D 绘制类。

Phase 1（ImageCache 改造）已将缓存对象类型确定为 `ImageBitmap`，本阶段依赖其接口。Phase 5（InfiniteCanvas 重写）将调用本阶段产出的 `draw()` 方法。

当前 `CanvasImageItem.ts`（493 行）和 `ImageInfoOverlay.ts`（315 行）完全耦合 PixiJS，需整体重写。

## Goals / Non-Goals

**Goals:**

- 将 `CanvasImageItem` 重写为无 PixiJS 依赖的纯 Canvas 2D 绘制类
- 保留所有现有视觉效果：占位色块、图片绘制、EXIF Orientation 旋转、选中/悬停边框+动画、信息覆盖层（渐变+Badge+合焦评分）
- 将 `ImageInfoOverlay` 的逻辑内联到 `CanvasImageItem` 中，消除独立文件
- 提供 `hitTest()` 方法替代 PixiJS 内建事件系统
- 支持分组切换时的 alpha 控制（供 InfiniteCanvas 淡入淡出）
- 选中动画在 Canvas 2D 按需渲染模式下正确驱动（返回 `needsNextFrame` 而非自行 rAF）

**Non-Goals:**

- 不改动 InfiniteCanvas 渲染循环（Phase 5 范围）
- 不改动 ImageCache/useImageLoader（Phase 1 范围）
- 不改动 DotBackground、GroupTitle（Phase 3 范围）
- 不改动 DetectionOverlay（Phase 4 范围）
- 不优化渲染性能（脏矩形、分层 canvas 等留到后续）
- 不处理鸟类检测框绘制（Phase 4 范围）

## Decisions

### 1. 类封装 vs 纯函数

**决策**: 保留类封装形式（`class CanvasImageItem`），但不继承任何基类。

**理由**: 每个图片项有独立的可变状态（选中/悬停/动画进度/alpha），类封装比纯函数+外部 state 更自然。PixiJS 的 `Container` 继承是唯一要移除的部分。

### 2. 动画驱动方式

**决策**: `draw()` 方法返回 `boolean`（`needsNextFrame`），由 InfiniteCanvas 的渲染循环决定是否继续 rAF。

**替代方案**: CanvasImageItem 自行管理 rAF → 与按需渲染模式冲突，多个 item 各自调度 rAF 会重复且不可控。

**理由**: 按需渲染架构下，渲染节奏由 InfiniteCanvas 统一控制。Item 只负责计算动画状态并告知是否需要下一帧。

### 3. 信息覆盖层内联 vs 独立类

**决策**: 内联到 `CanvasImageItem`，不再有独立的 `ImageInfoOverlay` 类。

**理由**: Canvas 2D 没有场景图，不需要对象层次。信息覆盖层只是 `draw()` 中的一段绘制代码，独立类增加不必要的抽象。辅助函数（`buildParamBadges`, `truncateFileName`, `maxCharsForWidth`）保留为模块级函数。

### 4. EXIF Orientation 实现

**决策**: 使用 `ctx.save/translate/rotate/scale/drawImage/restore` 实现全部 8 种 orientation。

**理由**: 数学逻辑与现有 PixiJS 实现完全对应，只是 API 从 `sprite.rotation/scale` 改为 `ctx.rotate/ctx.scale`。

### 5. 选中动画状态管理

**决策**: 内部维护 `selectionAnimStartTime` 和 `selectionAnimDirection`（in/out），在 `draw()` 中根据 `performance.now()` 计算动画进度。

**替代方案**: 外部传入动画进度 → 增加 InfiniteCanvas 的管理复杂度。

**理由**: 动画是 Item 自身的视觉关注点，内部管理更内聚。通过 `draw()` 返回值通知外部是否需要继续渲染。

### 6. 文字测量

**决策**: 使用 `ctx.measureText()` 进行文字宽度测量，用于 Badge 布局和文件名截断判断。

**理由**: Canvas 2D 原生能力，无需 PixiJS `Text` 对象的创建/销毁开销。在 Badge 构建时先测量后绘制。

## Risks / Trade-offs

- **Canvas 2D 文字锐度**: 低 DPR 屏幕上文字可能不如 PixiJS Text（Bitmap 缓存） → InfiniteCanvas 已通过 `canvas.width * dpr` 处理 DPR，文字渲染质量可接受
- **频繁 ctx.save/restore 开销**: 每个 item 的 draw 需要多次 save/restore（orientation、overlay 缩放） → 可见 item 仅 10-20 张，性能无压力
- **动画精度**: 选中动画依赖 `draw()` 被调用的频率 → InfiniteCanvas 在动画期间持续 rAF，保证 60fps
- **Badge 布局无缓存**: 每次 draw 都重新测量文字 → 可在 `setImageInfo` 时预计算缓存，但先实现基础版本
