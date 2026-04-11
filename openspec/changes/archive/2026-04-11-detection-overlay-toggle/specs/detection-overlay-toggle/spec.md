## ADDED Requirements

### Requirement: 检测框可见性全局开关

系统 SHALL 在 `useCanvasStore` 中提供 `showDetectionOverlay` 布尔状态（默认 `false`）和 `toggleDetectionOverlay()` action，控制所有图片检测框的可见性。

#### Scenario: 默认状态

- **WHEN** 应用首次启动
- **THEN** `showDetectionOverlay` SHALL 为 `false`，检测框不可见

#### Scenario: 切换开关

- **WHEN** 用户调用 `toggleDetectionOverlay()`，当前 `showDetectionOverlay` 为 `false`
- **THEN** `showDetectionOverlay` 变为 `true`，所有可见图片的检测框立即显示

#### Scenario: 关闭开关

- **WHEN** 用户调用 `toggleDetectionOverlay()`，当前 `showDetectionOverlay` 为 `true`
- **THEN** `showDetectionOverlay` 变为 `false`，所有图片的检测框立即隐藏

### Requirement: 检测框数据桥接

`InfiniteCanvas.updateItemMetadata()` SHALL 将 `metadata.detectionBboxes` 传递给 `CanvasImageItem.setDetectionBoxes()`，并根据 `useCanvasStore.showDetectionOverlay` 状态设置 `detectionVisible`。

#### Scenario: 开关打开时接收检测数据

- **WHEN** `showDetectionOverlay` 为 `true`，`focus-score-update` 事件携带 `detectionBboxes` 到达
- **THEN** `updateItemMetadata()` SHALL 调用 `canvasItem.setDetectionBoxes(bboxes)` 并 `canvasItem.setDetectionVisible(true)`

#### Scenario: 开关关闭时接收检测数据

- **WHEN** `showDetectionOverlay` 为 `false`，`focus-score-update` 事件携带 `detectionBboxes` 到达
- **THEN** `updateItemMetadata()` SHALL 调用 `canvasItem.setDetectionBoxes(bboxes)` 并 `canvasItem.setDetectionVisible(false)`

#### Scenario: 无检测框数据

- **WHEN** `metadata.detectionBboxes` 为空数组或 undefined
- **THEN** `updateItemMetadata()` SHALL 调用 `canvasItem.setDetectionBoxes([])` 并 `canvasItem.setDetectionVisible(false)`

### Requirement: 开关切换时批量回填

当用户切换 `showDetectionOverlay` 为 `true` 时，InfiniteCanvas SHALL 遍历所有可见 CanvasImageItem，从 `metadataMap` 读取 `detectionBboxes` 并设置到对应 item。

#### Scenario: 打开开关触发回填

- **WHEN** 用户切换 `showDetectionOverlay` 从 `false` 到 `true`，当前有 5 张可见图片，其中 3 张已有 `detectionBboxes` 数据
- **THEN** 这 3 张图片的 CanvasImageItem SHALL 调用 `setDetectionBoxes(bboxes)` 和 `setDetectionVisible(true)`

#### Scenario: 关闭开关清除可见性

- **WHEN** 用户切换 `showDetectionOverlay` 从 `true` 到 `false`
- **THEN** 所有可见 CanvasImageItem SHALL 调用 `setDetectionVisible(false)`

### Requirement: 图片重载后检测框恢复

当图片因 LRU 淘汰后重新加载（`needsReload` 路径），InfiniteCanvas SHALL 检查 `showDetectionOverlay` 状态，如为 `true` 则重新从 `metadataMap` 获取 `detectionBboxes` 并设置到 CanvasImageItem。

#### Scenario: 重载图片恢复检测框

- **WHEN** 图片被 LRU 淘汰后重新加载，`showDetectionOverlay` 为 `true`，该图片的 `metadata.detectionBboxes` 有 2 个框
- **THEN** 重新加载后 CanvasImageItem 的 `detectionBoxes` SHALL 包含这 2 个框，`detectionVisible` 为 `true`

### Requirement: 检测框可见性持久化

`showDetectionOverlay` 状态 SHALL 通过 `useSettingsSync` hook 持久化到 `$APPDATA/bulbul/settings.json`，应用重启后恢复。

#### Scenario: 关闭应用后恢复

- **WHEN** 用户设置 `showDetectionOverlay` 为 `true`，关闭应用后重新启动
- **THEN** `showDetectionOverlay` SHALL 恢复为 `true`

### Requirement: RightControlPanel 检测框切换按钮

RightControlPanel SHALL 在视图区域（适应窗口/实际大小按钮下方）新增检测框切换图标按钮，点击调用 `useCanvasStore.toggleDetectionOverlay()`。

#### Scenario: 按钮点击切换

- **WHEN** 用户点击检测框切换按钮
- **THEN** `showDetectionOverlay` 状态切换，检测框可见性立即变化

#### Scenario: 按钮视觉反馈

- **WHEN** `showDetectionOverlay` 为 `true`
- **THEN** 按钮 SHALL 显示激活态（高亮背景色）

#### Scenario: 按钮视觉反馈-关闭态

- **WHEN** `showDetectionOverlay` 为 `false`
- **THEN** 按钮 SHALL 显示默认态（与普通图标按钮一致）
