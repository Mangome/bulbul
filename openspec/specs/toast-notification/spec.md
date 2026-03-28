## ADDED Requirements

### Requirement: Toast 组件渲染

系统 SHALL 提供 `components/feedback/Toast.tsx` 组件，支持 4 种类型：`success`、`error`、`warning`、`info`。每种类型 SHALL 有对应的图标和颜色。Toast SHALL 固定显示在窗口右上角，多条 Toast 垂直堆叠。

#### Scenario: Success Toast 渲染

- **WHEN** 触发一条 success 类型的 Toast 消息
- **THEN** 在窗口右上角显示绿色调 Toast 卡片，包含成功图标和消息文本

#### Scenario: Error Toast 渲染

- **WHEN** 触发一条 error 类型的 Toast 消息
- **THEN** 在窗口右上角显示红色调 Toast 卡片，包含错误图标和消息文本

#### Scenario: 多条 Toast 堆叠

- **WHEN** 同时存在多条 Toast 消息
- **THEN** 按时间顺序垂直堆叠显示，最新的在最上方

### Requirement: Toast 自动消失

Toast 消息 SHALL 在指定时间后自动消失。默认持续时间为 3000ms（success/info）和 5000ms（error/warning）。

#### Scenario: 自动消失

- **WHEN** 一条 success Toast 显示 3000ms 后
- **THEN** Toast SHALL 自动移除并触发退出动画

#### Scenario: 手动关闭

- **WHEN** 用户点击 Toast 上的关闭按钮
- **THEN** Toast SHALL 立即触发退出动画并移除

#### Scenario: 鼠标悬停暂停

- **WHEN** 鼠标悬停在 Toast 上
- **THEN** 自动消失计时器 SHALL 暂停，鼠标离开后恢复计时

### Requirement: useToastStore 状态管理

系统 SHALL 提供 `stores/useToastStore.ts` Zustand Store，管理 Toast 消息队列。

#### Scenario: 添加 Toast

- **WHEN** 调用 `addToast({ type, message })` action
- **THEN** Toast 消息加入队列，分配唯一 id，同时最多显示 5 条

#### Scenario: 移除 Toast

- **WHEN** 调用 `removeToast(id)` action
- **THEN** 指定 id 的 Toast 从队列中移除

#### Scenario: 队列上限

- **WHEN** Toast 队列已有 5 条消息，又添加新消息
- **THEN** 最早的一条 SHALL 被移除，新消息加入队列

### Requirement: ToastContainer 全局挂载

系统 SHALL 在 `App.tsx` 中挂载 `ToastContainer` 组件，订阅 `useToastStore` 并渲染所有活跃的 Toast。

#### Scenario: 全局可用

- **WHEN** 应用任何位置调用 `useToastStore.getState().addToast()`
- **THEN** Toast SHALL 在当前窗口右上角显示
