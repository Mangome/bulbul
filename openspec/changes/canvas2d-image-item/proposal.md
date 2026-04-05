## Why

快速切换图片分组时，PixiJS 渲染管线因纹理生命周期竞态反复崩溃（`Cannot read properties of null (reading 'naturalWidth')`）。根因是手动释放 `texture.source.resource` 后，Batcher 异步渲染仍持有引用。PixiJS 在本项目中仅使用了 ~5% 的能力（Sprite、Graphics、Text、Container），其纹理管理系统已成为阻碍。Phase 2 将 `CanvasImageItem` 从 PixiJS 对象树重写为 Canvas 2D 绘制类，这是整个迁移的核心渲染单元。

## What Changes

- **重写 `CanvasImageItem.ts`**：从 PixiJS `Container`/`Sprite`/`Graphics` 继承改为纯 Canvas 2D 绘制类，暴露 `draw(ctx, zoom, now)` 方法
- **内联信息覆盖层**：将 `ImageInfoOverlay.ts` 的渐变背景、文件名、参数 Badge、合焦评分等绘制逻辑内联到 `CanvasImageItem.draw()` 中
- **Canvas 2D 实现所有视觉效果**：占位色块、图片绘制（含 EXIF Orientation 变换）、选中叠加层+边框+CheckMark 弹性动画、悬停边框、信息覆盖层缩放淡入
- **AABB 命中检测**：从 PixiJS `eventMode` 改为手动 `hitTest(contentX, contentY)` 坐标判定
- **删除 `ImageInfoOverlay.ts`**：逻辑合并后此文件不再需要

## Capabilities

### New Capabilities

- `canvas2d-image-item`: 基于 Canvas 2D API 的图片项绘制类，封装单张图片的完整渲染逻辑（占位色块、图片绘制、EXIF 旋转、选中/悬停视觉效果、信息覆盖层、CheckMark 动画、命中检测）

### Modified Capabilities

- `canvas-image-item`: 渲染技术从 PixiJS 对象树变更为 Canvas 2D `draw()` 调用，接口从 PixiJS Container 子类变更为独立类
- `infinite-canvas`: CanvasImageItem 不再是 PixiJS 子节点，InfiniteCanvas 需要在渲染循环中显式调用 `item.draw(ctx, zoom, now)` 并处理命中检测

## Impact

- **文件改动**：重写 `src/components/canvas/CanvasImageItem.ts`（493 行），删除 `src/components/canvas/ImageInfoOverlay.ts`（315 行）
- **依赖变更**：`CanvasImageItem.ts` 移除所有 `pixi.js` 导入，改为接收 `ImageBitmap`（来自 Phase 1 的 ImageCache）
- **接口变更**：InfiniteCanvas 与 CanvasImageItem 的交互从 PixiJS 场景图（addChild/removeChild）变为手动管理 Map 并在渲染循环中调用 `draw()`
- **代码复用**：选中/悬停状态机逻辑、EXIF 旋转数学、动画 easing、样式常量可从现有代码迁移
