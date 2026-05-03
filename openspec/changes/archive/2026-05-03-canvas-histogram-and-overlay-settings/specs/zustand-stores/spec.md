## MODIFIED Requirements

### Requirement: useCanvasStore 画布状态 Store
系统 SHALL 提供 `useCanvasStore` Zustand Store，包含状态：viewportX (number, 初始 0)、viewportY (number, 初始 0)、showDetectionOverlay (boolean, 初始 false)、showImageInfo (boolean, 初始 true)、showHistogram (boolean, 初始 false)。SHALL 提供 actions：setViewport、toggleDetectionOverlay（切换 showDetectionOverlay）、toggleImageInfo（切换 showImageInfo）、toggleHistogram（切换 showHistogram）。SHALL 提供分组导航状态和 actions：currentGroupIndex、groupCount、setGroupCount、goToGroup、nextGroup、prevGroup。showImageInfo 和 showHistogram SHALL 持久化到 settings.json。

#### Scenario: toggleDetectionOverlay 切换为 true
- **WHEN** showDetectionOverlay 为 false，调用 toggleDetectionOverlay()
- **THEN** showDetectionOverlay SHALL 变为 true

#### Scenario: toggleDetectionOverlay 切换为 false
- **WHEN** showDetectionOverlay 为 true，调用 toggleDetectionOverlay()
- **THEN** showDetectionOverlay SHALL 变为 false

#### Scenario: toggleImageInfo 切换为 false
- **WHEN** showImageInfo 为 true，调用 toggleImageInfo()
- **THEN** showImageInfo SHALL 变为 false，画布图片信息覆盖层立即隐藏

#### Scenario: toggleImageInfo 切换为 true
- **WHEN** showImageInfo 为 false，调用 toggleImageInfo()
- **THEN** showImageInfo SHALL 变为 true，画布图片信息覆盖层立即显示

#### Scenario: toggleHistogram 切换为 true
- **WHEN** showHistogram 为 false，调用 toggleHistogram()
- **THEN** showHistogram SHALL 变为 true，画布直方图立即显示

#### Scenario: toggleHistogram 切换为 false
- **WHEN** showHistogram 为 true，调用 toggleHistogram()
- **THEN** showHistogram SHALL 变为 false，画布直方图立即隐藏

#### Scenario: showImageInfo 持久化
- **WHEN** 用户切换 showImageInfo 后关闭应用
- **THEN** 下次启动时 showImageInfo SHALL 恢复为上次设置的值

#### Scenario: showHistogram 持久化
- **WHEN** 用户切换 showHistogram 后关闭应用
- **THEN** 下次启动时 showHistogram SHALL 恢复为上次设置的值
