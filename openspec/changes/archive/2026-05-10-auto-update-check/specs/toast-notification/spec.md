## ADDED Requirements

### Requirement: Toast 点击交互

Toast 消息 SHALL 支持可选的 onClick 回调，使 Toast 可点击交互。

#### Scenario: 可点击 Toast 渲染

- **WHEN** 创建 Toast 时提供了 onClick 回调
- **THEN** Toast 容器 SHALL 显示鼠标指针样式（cursor: pointer），用户可点击

#### Scenario: 点击 Toast 触发回调

- **WHEN** 用户点击带有 onClick 回调的 Toast
- **THEN** 系统 SHALL 先关闭该 Toast，再执行 onClick 回调函数

#### Scenario: 不可点击 Toast 保持原样

- **WHEN** 创建 Toast 时未提供 onClick 回调
- **THEN** Toast 容器 SHALL 保持默认鼠标样式，点击不触发额外行为
