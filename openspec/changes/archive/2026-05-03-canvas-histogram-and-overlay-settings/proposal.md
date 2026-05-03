## Why

用户需要在画布中快速评估照片的曝光分布，当前只能通过肉眼判断明暗，缺少量化的曝光参考。同时在设置界面中缺乏对画布信息覆盖层（图片信息、直方图）的显隐控制，用户无法根据需要切换这些视觉元素。

## What Changes

- 后端处理管线中新增 RGB 直方图计算（3×256 bins），存入 ImageMetadata 并缓存
- 前端 CanvasImageItem 新增直方图绘制，显示在图片底部信息覆盖层区域内
- 设置面板"外观设置"区新增两个 toggle：图片信息显隐、直方图显隐
- useCanvasStore 新增 `showImageInfo` 和 `showHistogram` 状态字段，持久化到 settings.json

## Capabilities

### New Capabilities
- `image-histogram`: 后端直方图计算 + 前端画布直方图绘制，包含数据模型、IPC 传递、Canvas 2D 渲染

### Modified Capabilities
- `canvas-image-item`: 新增直方图绘制区域，图片信息覆盖层和直方图受 store 开关控制
- `settings-panel`: 外观设置区新增图片信息和直方图两个 toggle 开关
- `zustand-stores`: useCanvasStore 新增 showImageInfo 和 showHistogram 状态 + 持久化
- `data-models`: ImageMetadata 新增 RGB 直方图字段

## Impact

- **后端**: `raw_processor.rs` 新增直方图计算逻辑，`ImageMetadata` 模型扩展，缓存格式变更（需向后兼容）
- **前端**: `CanvasImageItem.ts` 新增直方图绘制，`InfiniteCanvas.tsx` 传递 store 状态，设置面板组件扩展
- **IPC**: `get_metadata` 和 `get_batch_metadata` 返回数据新增直方图字段
- **缓存兼容**: 旧缓存无直方图数据，前端需处理直方图缺失情况（不绘制）
