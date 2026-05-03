## Purpose

导出进度弹窗 UI 组件及状态管理，在用户导出 RAW 文件时实时展示进度反馈。

## Requirements

### Requirement: ExportProgressDialog 组件

系统 SHALL 提供 `ExportProgressDialog` 模态对话框组件，展示导出操作的实时进度。样式 SHALL 使用 CSS Module（`ExportProgressDialog.module.css`）实现，支持亮色/暗色主题。SHALL 使用 motion 库实现弹出/关闭缩放动画。

#### Scenario: 显示条件

- **WHEN** `exportProgress` 不为 null
- **THEN** 显示 ExportProgressDialog

#### Scenario: 隐藏条件

- **WHEN** `exportProgress` 为 null
- **THEN** 隐藏 ExportProgressDialog

#### Scenario: 进度信息展示

- **WHEN** ExportProgressDialog 显示中
- **THEN** 展示以下信息：标题"正在导出..."、进度百分比大字、进度条（0-100%）、当前/总数计数、当前导出文件名、已用时间

#### Scenario: 导出完成后自动关闭

- **WHEN** 导出流程完成（`runExportFlow` 返回）
- **THEN** 延迟 500ms 后关闭弹窗，确保用户看到 100% 完成状态

#### Scenario: 弹出动画

- **WHEN** ExportProgressDialog 显示
- **THEN** 遮罩层透明度渐入，对话框从 scale 0.95 缩放弹出，与 ProgressDialog 动画风格一致

#### Scenario: 暗色主题

- **WHEN** 当前主题为 dark
- **THEN** 对话框背景、文字色、进度条样式 SHALL 使用暗色主题变量

### Requirement: 导出进度状态管理

MainPage SHALL 在导出流程中管理 `exportProgress` 状态（类型为 `ExportProgress | null`），通过 `runExportFlow` 的 `onProgress` 回调更新，驱动 ExportProgressDialog 的显隐和内容。

#### Scenario: 开始导出时显示进度

- **WHEN** 用户触发导出且选择了目标目录
- **THEN** `exportProgress` 被设为初始值 `{ current: 0, total: N, currentFile: null, elapsedMs: 0 }`，弹窗出现

#### Scenario: 进度更新

- **WHEN** 收到 `export-progress` 事件 `{ current: 3, total: 5, currentFile: "IMG_003.nef", elapsedMs: 12000 }`
- **THEN** `exportProgress` 更新为对应值，弹窗内容实时刷新

#### Scenario: 导出完成清除状态

- **WHEN** `runExportFlow` 返回（成功或失败）
- **THEN** 延迟 500ms 后将 `exportProgress` 置为 null，弹窗关闭

#### Scenario: 导出取消时清除状态

- **WHEN** 用户在目录选择对话框中取消
- **THEN** `exportProgress` 保持 null，不显示弹窗
