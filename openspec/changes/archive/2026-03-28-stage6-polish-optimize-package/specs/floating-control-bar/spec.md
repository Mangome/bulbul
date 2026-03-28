## MODIFIED Requirements

### Requirement: 控制栏缩放控件

FloatingControlBar SHALL 在主窗口底部居中悬浮显示，包含缩放滑块（范围 10%~300%）、`[-]` 缩小按钮、`[+]` 放大按钮、当前缩放百分比文本。所有缩放操作 SHALL 同步到 useCanvasStore。样式 SHALL 使用 CSS Module（`FloatingControlBar.module.css`）实现，支持亮色/暗色主题自动适配。SHALL 在挂载时播放从底部滑入的入场动画。

#### Scenario: 拖动滑块调整缩放

- **WHEN** 用户拖动缩放滑块到 150% 位置
- **THEN** useCanvasStore 的 zoomLevel 更新为 1.5，画布缩放同步变化

#### Scenario: 点击放大/缩小按钮

- **WHEN** 用户点击 `[+]` 按钮
- **THEN** zoomLevel 按步长 0.1 增加，不超过 3.0

#### Scenario: 缩放百分比实时显示

- **WHEN** 缩放级别为 1.5
- **THEN** 控制栏显示 "150%"

### Requirement: 适应窗口和实际大小

控制栏 SHALL 提供「适应窗口」和「实际大小」按钮。

#### Scenario: 点击适应窗口

- **WHEN** 用户点击「适应窗口」按钮
- **THEN** 调用 useCanvasStore 的 fitToWindow 方法，画布缩放至所有内容可见

#### Scenario: 点击实际大小

- **WHEN** 用户点击「实际大小」按钮
- **THEN** 调用 useCanvasStore 的 resetZoom 方法，缩放重置为 100%

### Requirement: 导出按钮入口

控制栏 SHALL 包含「导出」按钮，显示当前选中图片数量 Badge。按钮在无选中图片时 SHALL 处于 disabled 状态。

#### Scenario: 有选中图片时显示数量

- **WHEN** SelectionStore 中有 3 张图片被选中
- **THEN** 导出按钮旁 Badge 显示 "3"，按钮可点击

#### Scenario: 无选中图片时禁用

- **WHEN** SelectionStore 中无选中图片
- **THEN** 导出按钮处于 disabled 状态，Badge 不显示或显示 "0"

#### Scenario: 点击导出按钮

- **WHEN** 用户点击导出按钮
- **THEN** 弹出系统文件夹选择对话框，选择目录后触发导出流程

### Requirement: 控制栏视觉样式

控制栏 SHALL 采用 pill 形状容器，使用 CSS Module 实现毛玻璃效果（backdrop-filter: blur(20px)），各区域以竖线分隔。暗色主题下 SHALL 使用暗色面板变量。

#### Scenario: 控制栏正常渲染

- **WHEN** 主窗口打开且处理完成
- **THEN** 底部居中显示 pill 形控制栏，包含缩放区域、视图控制区域、导出区域，由竖线分隔

#### Scenario: 暗色主题控制栏

- **WHEN** 当前主题为 dark
- **THEN** 控制栏背景 SHALL 使用暗色面板变量，文字色使用暗色文字变量

### Requirement: 主题切换按钮

控制栏 SHALL 包含主题切换按钮，点击后切换亮色/暗色主题。

#### Scenario: 点击主题切换

- **WHEN** 用户点击主题切换按钮
- **THEN** 调用 `useThemeStore.toggleTheme()`，UI 主题即时切换
