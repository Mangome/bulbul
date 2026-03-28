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

### Requirement: CSP 安全策略

`tauri.conf.json` 的 `app.security.csp` SHALL 允许 `'unsafe-inline'` 样式（CSS Module 需要）和 asset 协议。

#### Scenario: CSS Module 兼容

- **WHEN** 前端使用 CSS Module 加载样式
- **THEN** CSP 策略 SHALL 不阻止样式注入
