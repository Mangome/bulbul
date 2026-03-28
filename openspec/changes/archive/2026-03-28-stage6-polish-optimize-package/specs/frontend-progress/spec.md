## MODIFIED Requirements

### Requirement: ProgressDialog 组件

系统 SHALL 提供 `ProgressDialog` 模态对话框组件，展示处理流水线的实时进度。样式 SHALL 使用 CSS Module（`ProgressDialog.module.css`）实现，支持亮色/暗色主题。SHALL 使用 motion 库实现弹出/关闭缩放动画。

#### Scenario: 显示条件

- **WHEN** `processingState` 不为 idle 且不为 completed
- **THEN** 显示 ProgressDialog

#### Scenario: 进度信息展示

- **WHEN** ProgressDialog 显示中
- **THEN** 展示以下信息：当前阶段文本标签、进度条（0-100%）、当前/总数计数、当前处理文件名、已用时间、预估剩余时间

#### Scenario: 取消按钮

- **WHEN** 处理进行中（scanning/processing/analyzing/grouping）
- **THEN** 显示取消按钮，点击后调用 `cancelProcessing()`

#### Scenario: 阶段标签映射

- **WHEN** 当前状态为 scanning
- **THEN** 显示 "扫描文件中..."
- **WHEN** 当前状态为 processing
- **THEN** 显示 "处理图片中..."
- **WHEN** 当前状态为 analyzing
- **THEN** 显示 "分析相似度中..."
- **WHEN** 当前状态为 grouping
- **THEN** 显示 "分组中..."

#### Scenario: 时间格式化

- **WHEN** 已用时间为 125000ms
- **THEN** 显示格式化文本如 "2:05"

#### Scenario: 弹出动画

- **WHEN** ProgressDialog 显示
- **THEN** 遮罩层透明度渐入，对话框从 scale 0.95 缩放弹出

#### Scenario: 暗色主题对话框

- **WHEN** 当前主题为 dark
- **THEN** 对话框背景、文字色、进度条样式 SHALL 使用暗色主题变量
