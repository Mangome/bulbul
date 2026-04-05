## Why

快速切换图片分组时，PixiJS 纹理生命周期竞态导致反复崩溃（`Cannot read properties of null (reading 'naturalWidth')`）。根因是手动释放 `texture.source.resource` 后，PixiJS Batcher 异步渲染管线仍持有引用。项目仅使用 PixiJS ~5% 的能力（Sprite、Graphics、Text、Container），纹理管理系统阻碍大于帮助。Phase 1 作为整体 Canvas 2D 迁移的第一步，先将图片缓存层从 PixiJS Texture 迁移到原生 ImageBitmap，为后续阶段（CanvasImageItem、InfiniteCanvas 重写）奠定基础。

## What Changes

- 将 `TextureLRUCache` 重命名为 `ImageLRUCache`，缓存对象从 `Texture` 改为 `ImageBitmap`
- 移除 `useImageLoader.ts` 中所有 PixiJS 依赖（`Texture`、`ImageSource` 导入）
- 销毁逻辑从复杂的多步操作（source.resource = null → source.unload → texture.destroy）简化为单行 `bitmap.close()`
- 加载逻辑从 `fetch → createImageBitmap → new ImageSource → new Texture` 简化为 `fetch → createImageBitmap`
- `ImageLoader` 类对外接口从返回 `Texture` 改为返回 `ImageBitmap`
- **BREAKING**: `CacheEntry` 类型从 `{ texture: Texture }` 改为 `{ image: ImageBitmap }`，所有消费者需适配
- 更新 `useImageLoader.test.ts`，移除 PixiJS mock，改为 ImageBitmap 断言

## Capabilities

### New Capabilities
- `image-bitmap-cache`: ImageBitmap 为基础的 LRU 缓存系统，替代 PixiJS Texture 缓存。覆盖缓存策略、内存估算、加载/销毁生命周期。

### Modified Capabilities
_(无需修改现有 spec 级别的需求。虽然 `canvas-image-item` 和 `infinite-canvas` 是消费者，但它们的 spec 需求不变——API 变更属于实现细节，将在后续 Phase 中处理。)_

## Impact

- **直接改动文件**: `src/hooks/useImageLoader.ts`、`src/hooks/useImageLoader.test.ts`
- **消费者需适配**（后续 Phase 处理）: `InfiniteCanvas.tsx`、`CanvasImageItem.ts`——它们当前使用 `Texture` 类型，需在 Phase 2/5 中改为 `ImageBitmap`
- **依赖变更**: Phase 1 完成后 `useImageLoader.ts` 不再依赖 `pixi.js`，但 `pixi.js` 包暂不移除（其他文件仍依赖），待 Phase 6 统一清理
- **风险**: ImageBitmap `.close()` 后 `drawImage()` 静默无操作（不崩溃），彻底消除纹理竞态崩溃
