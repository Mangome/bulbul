## MODIFIED Requirements

### Requirement: RightControlPanel 检测框切换按钮
检测框开关 SHALL 迁移到设置面板的外观设置区域中，TopNavBar 不再提供检测框切换按钮。

#### Scenario: 通过设置面板切换检测框
- **WHEN** 用户在设置面板中切换检测框开关
- **THEN** `showDetectionOverlay` 状态 SHALL 切换，检测框可见性立即变化

#### Scenario: 开关反映当前状态
- **WHEN** 设置面板打开且 `showDetectionOverlay` 为 `true`
- **THEN** 检测框开关 SHALL 显示为开启状态

#### Scenario: 开关反映关闭状态
- **WHEN** 设置面板打开且 `showDetectionOverlay` 为 `false`
- **THEN** 检测框开关 SHALL 显示为关闭状态
