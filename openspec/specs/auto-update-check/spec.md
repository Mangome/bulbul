## Purpose

在应用主窗口启动时自动静默检查更新，发现新版本时通过 Toast 通知用户。

## Requirements

### Requirement: 启动时自动检查更新

系统 SHALL 在主窗口加载完成后自动执行一次静默更新检查，不阻塞 UI 渲染。

#### Scenario: 主窗口启动时触发检查

- **WHEN** 主窗口（label 为 "main"）完成初始化
- **THEN** 系统 SHALL 在后台调用更新检查接口，不显示任何加载状态

#### Scenario: 发现新版本时通知用户

- **WHEN** 自动检查返回可用的更新
- **THEN** 系统 SHALL 显示 info 类型 Toast，消息包含新版本号，Toast 可点击并打开设置面板的版本更新区域

#### Scenario: 当前已是最新版本

- **WHEN** 自动检查返回无可用更新
- **THEN** 系统 SHALL 不显示任何提示

#### Scenario: 自动检查失败

- **WHEN** 自动检查因网络错误或其他原因失败
- **THEN** 系统 SHALL 不显示任何错误提示，不影响用户正常使用

#### Scenario: 防止重复检查

- **WHEN** React StrictMode 在开发模式下双重调用 effect
- **THEN** 系统 SHALL 仅执行一次更新检查，不重复请求

### Requirement: 自动检查仅在主窗口执行

系统 SHALL 仅在主窗口执行自动更新检查，欢迎窗口不执行。

#### Scenario: 欢迎窗口不触发检查

- **WHEN** 应用启动但当前窗口为 welcome 窗口
- **THEN** 系统 SHALL 不执行自动更新检查
