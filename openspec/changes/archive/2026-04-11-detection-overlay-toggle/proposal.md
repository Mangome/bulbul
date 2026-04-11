## Why

后端已完成鸟类主体检测和合焦评分，检测框数据（`detectionBboxes`）已通过 IPC 传到前端并存储在 `metadataMap` 中，但渲染管线存在断点——`updateItemMetadata()` 只调用了 `setImageInfo()` 更新 Badge，从未将 `detectionBboxes` 传递给 `setDetectionBoxes()` 或设置 `detectionVisible = true`，导致 `drawDetectionOverlay()` 从未被触发。用户无法看到合焦检测区域，合焦评分的参考价值大打折扣。

## What Changes

- 在 `updateItemMetadata()` 中将 `metadata.detectionBboxes` 桥接到 `CanvasImageItem.setDetectionBoxes()`，补全渲染管线断点
- 新增全局开关（`useCanvasStore.showDetectionOverlay`），控制检测框可见性，默认关闭
- 在 RightControlPanel 新增检测框切换按钮（图标按钮，与其他工具按钮风格一致）
- 叠加缩放阈值：当 `zoomLevel < 0.4` 时即使开关打开也不绘制检测框，避免缩小时检测框糊成一团
- 切换开关时，遍历所有可见 CanvasImageItem 回填已有的 `detectionBboxes` 数据

## Capabilities

### New Capabilities
- `detection-overlay-toggle`: 检测框可见性全局开关，包含缩放阈值控制、状态回填

### Modified Capabilities
- `detection-overlay-ui`: 新增缩放阈值过滤逻辑——当 zoomLevel < 0.4 时跳过绘制
- `zustand-stores`: useCanvasStore 新增 `showDetectionOverlay` 状态和 `toggleDetectionOverlay` action

## Impact

- **前端状态**: `useCanvasStore` 新增 `showDetectionOverlay` 字段，需同步到 `$APPDATA/bulbul/settings.json` 持久化
- **Canvas 渲染**: `CanvasImageItem.draw()` 中的检测框绘制条件从 `detectionVisible` 改为 `detectionVisible && zoomLevel >= 0.4`
- **RightControlPanel**: 新增一个图标按钮，视觉上与现有按钮一致
- **InfiniteCanvas**: `updateItemMetadata()` 需读取 `showDetectionOverlay` 状态并同步到 CanvasImageItem
