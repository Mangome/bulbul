## MODIFIED Requirements

### Requirement: useCanvasStore 画布状态 Store

系统 SHALL 提供 `useCanvasStore` Zustand Store，包含状态：zoomLevel (number, 初始 1.0)、viewportX (number, 初始 0)、viewportY (number, 初始 0)、showDetectionOverlay (boolean, 初始 false)。SHALL 提供 actions：setZoom（限制范围 0.1~3.0）、setViewport、zoomIn（+0.1 步进）、zoomOut（-0.1 步进）、fitToWindow、resetZoom（重置为 1.0）、toggleDetectionOverlay（切换 showDetectionOverlay）。

#### Scenario: 缩放范围限制
- **WHEN** 调用 setZoom(5.0)
- **THEN** zoomLevel SHALL 被限制为 3.0（最大值）

#### Scenario: 缩放范围下限
- **WHEN** 调用 setZoom(0.01)
- **THEN** zoomLevel SHALL 被限制为 0.1（最小值）

#### Scenario: zoomIn 步进
- **WHEN** zoomLevel 为 1.0 时调用 zoomIn()
- **THEN** zoomLevel SHALL 变为 1.1

#### Scenario: toggleDetectionOverlay 切换为 true
- **WHEN** showDetectionOverlay 为 false，调用 toggleDetectionOverlay()
- **THEN** showDetectionOverlay SHALL 变为 true

#### Scenario: toggleDetectionOverlay 切换为 false
- **WHEN** showDetectionOverlay 为 true，调用 toggleDetectionOverlay()
- **THEN** showDetectionOverlay SHALL 变为 false
