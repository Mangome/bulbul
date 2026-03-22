## Why

Stage 3 已完成端到端的 NEF 处理流水线（扫描→解析→pHash→分组），`GroupResult` 数据已可传递到前端，但主窗口仍是占位文本——用户无法浏览分组后的图片。Stage 4 的核心任务是引入 PixiJS WebGL 无限画布，将分组图片以瀑布流形式可视化呈现，实现高性能的千级别图片浏览体验。

## What Changes

- **新增 PixiJS 无限画布**：基于 PixiJS v8 创建 WebGL 画布，支持滚轮缩放（锚点缩放 10%~300%）和拖拽平移
- **新增瀑布流布局引擎**：3 列瀑布流 + 分组标题 + 间距计算，一次性预计算所有图片的绝对坐标
- **新增视口虚拟化渲染**：仅加载视口内（+ 缓冲区）图片的 GPU 纹理，视口外纹理自动卸载，支持分级加载（缩放阈值切换 thumbnail/medium）
- **新增纹理 LRU 管理**：控制同时加载的纹理数量（≤300 张），LRU 淘汰策略回收 GPU 内存
- **新增图片项渲染组件**：PixiJS Sprite + 占位色块 + 加载状态 + 底部渐变信息覆盖层（文件名 + 拍摄参数 Badge）
- **新增波点底纹背景**：TilingSprite 实现无限重复波点纹理，不受画布缩放影响
- **新增 Rust 图片服务命令**：`get_image_url`（缓存路径→asset:// 协议 URL）+ `get_metadata`（hash→ImageMetadata 查询）
- **更新 MainPage**：替换占位文本为真实的 PixiJS 画布，集成布局计算和图片加载
- **增强 useCanvasStore**：连接到实际画布实例，驱动缩放/平移的真实渲染

## Capabilities

### New Capabilities
- `infinite-canvas`: PixiJS Application 初始化、Stage 层级结构、滚轮缩放（锚点缩放）、拖拽平移、视口管理
- `dot-background`: 波点底纹背景渲染（TilingSprite，独立于内容层，不受缩放影响）
- `waterfall-layout`: 瀑布流布局算法（3 列 + 分组标题 + 间距），支持不同宽高比图片的坐标计算
- `viewport-virtualization`: 视口裁剪引擎 + 纹理 LRU 管理 + 分级加载（thumbnail/medium 阈值切换）
- `canvas-image-item`: 图片项 PixiJS 渲染（Sprite + 占位色块 + 底部渐变信息覆盖层 + Badge）
- `image-commands`: Rust 端图片 URL 和元数据查询命令（`get_image_url` + `get_metadata` + `get_batch_metadata`）

### Modified Capabilities
_(无需修改现有 spec 的需求定义)_

## Impact

- **前端新增文件**: `InfiniteCanvas.tsx`, `DotBackground.tsx`, `CanvasImageItem.tsx`, `ImageInfoOverlay.tsx`, `utils/layout.ts`, `hooks/useImageLoader.ts`
- **前端修改文件**: `MainPage.tsx`（替换占位为画布）, `useCanvasStore.ts`（连接真实画布）
- **Rust 新增文件**: `commands/image_commands.rs`（已有骨架，需补充实现）
- **新增依赖**: `pixi.js ^8`, `@pixi/react ^8`（package.json）
- **性能约束**: 画布 60fps、GPU 纹理内存 ≤300MB、同时渲染纹理 ≤300 张
- **预估代码量**: ~2200 行（前端 ~2000 行，Rust ~200 行）
