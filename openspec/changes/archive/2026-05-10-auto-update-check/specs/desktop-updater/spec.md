## ADDED Requirements

### Requirement: 启动时自动检查更新

系统 SHALL 在应用主窗口启动时自动静默检查 GitHub Releases 提供的更新，不自动安装。

#### Scenario: 启动时静默检查

- **WHEN** 主窗口完成初始化
- **THEN** 系统 SHALL 在后台访问更新端点检查新版本，不显示任何加载状态或进度

#### Scenario: 检查到新版本时通知

- **WHEN** 启动时自动检查发现可安装的新版本
- **THEN** 系统 SHALL 通过可点击的 Toast 通知用户，Toast 包含新版本号，点击后打开设置面板的版本更新区域

#### Scenario: 检查无更新或失败时静默

- **WHEN** 启动时自动检查未发现新版本，或检查因网络等问题失败
- **THEN** 系统 SHALL 不显示任何通知或错误提示
