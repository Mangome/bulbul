## MODIFIED Requirements

### Requirement: useCanvasStore 画布状态 Store
系统 SHALL 提供 `useCanvasStore` Zustand Store，包含状态：viewportX (number, 初始 0)、viewportY (number, 初始 0)、showDetectionOverlay (boolean, 初始 false)。SHALL 提供 actions：setViewport、toggleDetectionOverlay（切换 showDetectionOverlay）。SHALL 提供分组导航状态和 actions：currentGroupIndex、groupCount、setGroupCount、goToGroup、nextGroup、prevGroup。

#### Scenario: toggleDetectionOverlay 切换为 true
- **WHEN** showDetectionOverlay 为 false，调用 toggleDetectionOverlay()
- **THEN** showDetectionOverlay SHALL 变为 true

#### Scenario: toggleDetectionOverlay 切换为 false
- **WHEN** showDetectionOverlay 为 true，调用 toggleDetectionOverlay()
- **THEN** showDetectionOverlay SHALL 变为 false

## REMOVED Requirements

### Requirement: 缩放范围限制
**Reason**: 画布不再支持缩放功能
**Migration**: 移除 zoomLevel 状态和 setZoom/zoomIn/zoomOut/resetZoom/fitToWindow actions

### Requirement: zoomIn 步进
**Reason**: 画布不再支持缩放功能
**Migration**: 移除 zoomIn action
