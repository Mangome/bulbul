## MODIFIED Requirements

### Requirement: 底部信息覆盖层
每个图片项在缩略图模式下 SHALL 不显示底部信息覆盖层，信息由悬浮放大镜展示。当 `showImageInfo` 为 false 时，信息覆盖层文字 SHALL 不绘制。信息覆盖层的渐变背景 SHALL 在直方图或文字任一可见时绘制。

#### Scenario: 缩略图模式隐藏信息覆盖层
- **WHEN** 缩略图模式激活
- **THEN** 信息覆盖层 SHALL 始终不绘制，无论缩放级别如何

#### Scenario: 缩放级别不影响信息覆盖层
- **WHEN** 用户缩放画布
- **THEN** 缩略图模式下信息覆盖层 SHALL 始终隐藏

#### Scenario: 隐藏图片信息文字
- **WHEN** `showImageInfo` 为 false
- **THEN** 信息覆盖层文字（文件名、拍摄参数）SHALL 不绘制

#### Scenario: 显示图片信息文字
- **WHEN** `showImageInfo` 为 true
- **THEN** 信息覆盖层文字 SHALL 正常绘制

#### Scenario: 渐变背景自适应
- **WHEN** 直方图或信息文字任一可见
- **THEN** 渐变背景 SHALL 绘制，高度覆盖所有可见内容
- **WHEN** 直方图和信息文字均不可见
- **THEN** 渐变背景 SHALL 不绘制
