## MODIFIED Requirements

### Requirement: Welcome 窗口配置

`tauri.conf.json` 的 app.windows SHALL 配置一个窗口：label 为 `welcome`，title 为 `Bulbul`，width 为 600，height 为 450，resizable 为 false，center 为 true，decorations 为 true。

#### Scenario: Welcome 窗口尺寸正确

- **WHEN** 应用启动
- **THEN** Welcome 窗口尺寸 SHALL 为 600x450，不可调整大小

## ADDED Requirements

### Requirement: Bundle 完整配置

`tauri.conf.json` 的 `bundle` 配置 SHALL 包含完整的发布配置：`active: true`、`targets: "all"`、完整图标列表、`windows.nsis` 安装器配置。

#### Scenario: NSIS 安装器配置

- **WHEN** 执行 `cargo tauri build`
- **THEN** SHALL 生成 NSIS 安装器，支持选择安装路径和创建桌面快捷方式

#### Scenario: Bundle 元数据

- **WHEN** 查看 `tauri.conf.json` bundle 配置
- **THEN** SHALL 包含 `productName: "Bulbul"`、`identifier: "com.bulbul.app"`、`copyright` 字段

### Requirement: Updater 运行时配置

桌面端配置 SHALL 定义 updater 所需的公钥、更新端点和 updater artifacts 生成选项，使应用能够校验并安装来自 GitHub Releases 的更新。

#### Scenario: 配置更新端点与公钥

- **WHEN** 查看桌面应用配置
- **THEN** SHALL 存在指向 GitHub Release `latest.json` 的 updater endpoint，以及用于校验更新签名的公钥配置

#### Scenario: 构建 updater artifacts

- **WHEN** 执行发布构建
- **THEN** 构建系统 SHALL 生成 updater 所需的安装产物与签名文件，而不仅是普通安装包

### Requirement: Updater 插件与权限配置

桌面应用 SHALL 注册 updater 与 process 相关插件，并开放执行检查更新、安装更新和重启应用所需的 capability 权限。

#### Scenario: 前端可调用更新能力

- **WHEN** 前端执行检查更新或安装更新逻辑
- **THEN** 运行时 SHALL 允许调用 updater 插件 API 完成更新流程

#### Scenario: 安装后允许重启

- **WHEN** 更新安装完成且需要重启应用
- **THEN** 运行时 SHALL 允许前端触发应用重启以完成版本切换

### Requirement: CSP 安全策略

`tauri.conf.json` 的 `app.security.csp` SHALL 允许 `'unsafe-inline'` 样式（CSS Module 需要）和 asset 协议。

#### Scenario: CSS Module 兼容

- **WHEN** 前端使用 CSS Module 加载样式
- **THEN** CSP 策略 SHALL 不阻止样式注入
