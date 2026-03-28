## ADDED Requirements

### Requirement: ErrorBoundary 组件

系统 SHALL 提供 `components/feedback/ErrorBoundary.tsx` React 错误边界组件，捕获子组件树中的未处理渲染错误。

#### Scenario: 捕获渲染错误

- **WHEN** ErrorBoundary 的子组件在渲染过程中抛出异常
- **THEN** ErrorBoundary SHALL 捕获错误，阻止白屏，显示回退 UI

#### Scenario: 回退 UI 展示

- **WHEN** 错误被捕获
- **THEN** 显示友好的错误提示界面，包含错误摘要信息和「重试」按钮

#### Scenario: 重试恢复

- **WHEN** 用户点击回退 UI 中的「重试」按钮
- **THEN** ErrorBoundary SHALL 清除错误状态，重新渲染子组件树

#### Scenario: 错误日志

- **WHEN** 错误被捕获
- **THEN** 错误详情 SHALL 输出到 `console.error`，包含组件堆栈信息

### Requirement: App 级别 ErrorBoundary 包裹

`App.tsx` SHALL 在最外层使用 ErrorBoundary 包裹所有页面路由，确保任何未处理的渲染错误都能被捕获。

#### Scenario: 全局错误兜底

- **WHEN** 任何页面组件发生未处理的渲染错误
- **THEN** ErrorBoundary SHALL 捕获错误并显示回退 UI，而非白屏
