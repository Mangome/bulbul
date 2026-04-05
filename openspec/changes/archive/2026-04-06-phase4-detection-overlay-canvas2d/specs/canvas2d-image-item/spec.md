## MODIFIED Requirements

### Requirement: Canvas 2D 图片绘制
系统 SHALL 通过 `CanvasImageItem.draw(ctx, zoom, now)` 方法将图片项绘制到指定的 `CanvasRenderingContext2D` 上。当 `alpha <= 0` 时 SHALL 跳过绘制。

绘制顺序 SHALL 为：
1. 占位色块或图片（应用 EXIF Orientation）
2. 检测框覆盖层（当 `detectionVisible` 为 true 且有检测数据时）
3. 信息覆盖层（缩放阈值控制可见性）
4. 选中/悬停视觉效果

#### Scenario: 正常图片绘制
- **WHEN** `draw()` 被调用且 `image` 不为 null 且 `alpha > 0`
- **THEN** 系统 SHALL 调用 `ctx.drawImage(image, 0, 0, width, height)` 绘制图片（应用 EXIF Orientation 变换后）

#### Scenario: 占位色块绘制
- **WHEN** `draw()` 被调用且 `image` 为 null
- **THEN** 系统 SHALL 绘制 `#E0E4EB` 填充色矩形，尺寸与 `width/height` 一致

#### Scenario: 隐藏分组不绘制
- **WHEN** `draw()` 被调用且 `alpha <= 0`
- **THEN** 系统 SHALL 立即返回，不执行任何绘制操作

#### Scenario: 检测框在信息覆盖层之下绘制
- **WHEN** `draw()` 被调用且 `detectionVisible` 为 true 且 `detectionBoxes` 非空
- **THEN** 系统 SHALL 在图片/占位色块之后、信息覆盖层之前调用检测框绘制函数

## ADDED Requirements

### Requirement: 检测框数据管理

`CanvasImageItem` SHALL 提供 `setDetectionBoxes(boxes: DetectionBox[])` 方法设置检测框数据，以及 `setDetectionVisible(visible: boolean)` 方法控制检测框的显示/隐藏。

#### Scenario: 设置检测框数据
- **WHEN** `setDetectionBoxes([{x1: 0.2, y1: 0.1, x2: 0.8, y2: 0.9, confidence: 0.95}])` 被调用
- **THEN** 系统 SHALL 存储检测框数据，供后续 `draw()` 使用

#### Scenario: 显示检测框
- **WHEN** `setDetectionVisible(true)` 被调用且有检测框数据
- **THEN** 后续 `draw()` 调用 SHALL 绘制检测框覆盖层

#### Scenario: 隐藏检测框
- **WHEN** `setDetectionVisible(false)` 被调用
- **THEN** 后续 `draw()` 调用 SHALL 不绘制检测框覆盖层

#### Scenario: 无检测数据时不绘制
- **WHEN** `detectionVisible` 为 true 但 `detectionBoxes` 为空数组
- **THEN** 后续 `draw()` 调用 SHALL 不绘制检测框覆盖层

### Requirement: 资源清理包含检测数据

`CanvasImageItem.destroy()` SHALL 清理检测框数据。

#### Scenario: destroy 清理检测数据
- **WHEN** `destroy()` 被调用
- **THEN** 系统 SHALL 将 `detectionBoxes` 置为空数组，`detectionVisible` 置为 false
