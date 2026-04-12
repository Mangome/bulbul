## Why

新布局采用固定列数 + 自适应宽度的设计，画布缩放功能已不再适用。缩放相关代码分散在 store、画布渲染、键盘快捷键、UI 控件和持久化等多个模块中，保留这些死代码会增加维护成本和认知负担。现在是清理的最佳时机。

## What Changes

- **BREAKING**: 移除画布缩放功能（Ctrl+滚轮缩放、缩放滑块、缩放按钮、适应窗口、重置缩放）
- 从 `useCanvasStore` 移除 `zoomLevel` 状态和所有缩放 actions（`setZoom`, `zoomIn`, `zoomOut`, `resetZoom`, `fitToWindow`）
- 从 `InfiniteCanvas` 移除缩放变换、Ctrl+滚轮处理、缩放阈值质量切换
- 从 `RightControlPanel` 移除缩放控件区域（-/+按钮、滑块、百分比、适应窗口、1:1按钮）
- 从 `useKeyboard` 移除 Ctrl+0/1/+/- 缩放快捷键
- 从设置持久化中移除 `zoomLevel` 字段
- 简化坐标变换：所有坐标计算不再除以/乘以 zoom

## Capabilities

### New Capabilities

（无新增能力）

### Modified Capabilities

- `infinite-canvas`: 移除缩放变换和缩放事件处理，坐标系简化为 1:1 映射
- `zustand-stores`: useCanvasStore 移除 zoomLevel 及相关 actions
- `keyboard-shortcuts`: 移除 Ctrl+0/1/+/- 缩放快捷键
- `floating-control-bar`: 移除缩放控件（RightControlPanel 中的缩放区域）
- `magnifier-overlay`: Loupe 组件 zoom 参数固定为 1，简化坐标映射
- `canvas2d-image-item`: draw() 中移除缩放相关逻辑

## Impact

- **前端状态**: useCanvasStore 接口变化（移除 zoomLevel/setZoom/zoomIn/zoomOut/resetZoom/fitToWindow/fitCounter）
- **持久化**: settings.json 不再包含 zoomLevel 字段（向后兼容，加载时忽略旧字段）
- **UI**: RightControlPanel 缩放区域消失，面板变短
- **画布渲染**: ctx.scale(zoom, zoom) 移除，简化渲染管线
- **涉及文件**: ~10 个源文件 + ~4 个测试文件
