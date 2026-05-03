## MODIFIED Requirements

### Requirement: 设置面板外观设置区域
设置面板 SHALL 包含外观设置区域，提供检测框覆盖层开关（toggle）、图片信息开关（toggle）和直方图开关（toggle）。

#### Scenario: 切换检测框开关
- **WHEN** 用户点击检测框开关
- **THEN** `showDetectionOverlay` 状态 SHALL 切换，画布检测框可见性立即变化

#### Scenario: 开关反映当前状态
- **WHEN** 设置面板打开且 `showDetectionOverlay` 为 `true`
- **THEN** 检测框开关 SHALL 显示为开启状态

#### Scenario: 切换图片信息开关
- **WHEN** 用户点击图片信息开关
- **THEN** `showImageInfo` 状态 SHALL 切换，画布图片信息覆盖层可见性立即变化

#### Scenario: 图片信息开关反映当前状态
- **WHEN** 设置面板打开且 `showImageInfo` 为 `true`
- **THEN** 图片信息开关 SHALL 显示为开启状态

#### Scenario: 切换直方图开关
- **WHEN** 用户点击直方图开关
- **THEN** `showHistogram` 状态 SHALL 切换，画布直方图可见性立即变化

#### Scenario: 直方图开关反映当前状态
- **WHEN** 设置面板打开且 `showHistogram` 为 `true`
- **THEN** 直方图开关 SHALL 显示为开启状态
