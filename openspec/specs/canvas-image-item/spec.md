## Requirements

### Requirement: 底部信息覆盖层
每个图片项在缩略图模式下 SHALL 不显示底部信息覆盖层，信息由悬浮放大镜展示。

#### Scenario: 缩略图模式隐藏信息覆盖层
- **WHEN** 缩略图模式激活
- **THEN** 信息覆盖层 SHALL 始终不绘制，无论缩放级别如何

#### Scenario: 缩放级别不影响信息覆盖层
- **WHEN** 用户缩放画布
- **THEN** 缩略图模式下信息覆盖层 SHALL 始终隐藏

### Requirement: 图片悬停高亮
CanvasImageItem SHALL 不再绘制悬停高亮效果，悬停交互由悬浮放大镜替代。

#### Scenario: 鼠标悬停无画布内效果
- **WHEN** 鼠标指针进入缩略图区域
- **THEN** CanvasImageItem SHALL 不绘制悬停高亮边框和发光效果
- **AND** 悬停反馈由 Magnifier 组件提供

### Requirement: 选中效果简化
缩略图模式下选中效果 SHALL 简化为半透明蓝色遮罩 + 右上角小对勾。

#### Scenario: 选中缩略图显示
- **WHEN** 一张缩略图被选中
- **THEN** 缩略图上 SHALL 叠加半透明蓝色遮罩（SELECTION_COLOR 8% alpha）
- **AND** 右上角 SHALL 显示小对勾标记
- **AND** 选中效果带渐入动画

#### Scenario: 取消选中
- **WHEN** 一张缩略图取消选中
- **THEN** 蓝色遮罩和对勾 SHALL 以渐出动画消失
