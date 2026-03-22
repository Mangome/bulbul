## ADDED Requirements

### Requirement: useTauriEvents Hook

系统 SHALL 提供 `useTauriEvents` 通用 Hook，封装 Tauri 事件的监听和自动清理。接受事件名和回调函数，返回取消监听的函数。组件卸载时 MUST 自动取消所有事件监听。

#### Scenario: 监听事件

- **WHEN** 使用 `useTauriEvents("processing-progress", callback)` 注册监听
- **THEN** 每当 Rust 端 emit `processing-progress` 事件时，`callback` 被调用并传入事件 payload

#### Scenario: 组件卸载清理

- **WHEN** 包含 `useTauriEvents` 的组件卸载
- **THEN** 自动取消事件监听，不会导致内存泄漏或状态更新已卸载组件

### Requirement: useProcessing Hook

系统 SHALL 提供 `useProcessing` Hook，封装处理流水线的完整生命周期：触发处理（`startProcessing`）、监听进度、处理完成/失败/取消回调、取消处理（`cancelProcessing`）。

#### Scenario: 状态流转

- **WHEN** 调用 `startProcessing(folderPath)`
- **THEN** 状态依次从 idle → scanning → processing → analyzing → grouping → completed 流转，每次状态变更同步更新到 `useAppStore`

#### Scenario: 取消处理

- **WHEN** 调用 `cancelProcessing()`
- **THEN** 状态变为 cancelling → cancelled

#### Scenario: 处理完成回调

- **WHEN** 流水线完成并返回 `GroupResult`
- **THEN** 调用 `onCompleted` 回调，`useAppStore.setGroups(result)` 被触发

#### Scenario: 处理失败回调

- **WHEN** 流水线处理出错
- **THEN** 状态变为 error，错误信息通过 `onFailed` 回调传出

### Requirement: ProgressDialog 组件

系统 SHALL 提供 `ProgressDialog` 模态对话框组件，展示处理流水线的实时进度。

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
