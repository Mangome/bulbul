## ADDED Requirements

### Requirement: Tauri 插件集成
系统 SHALL 在 `lib.rs` 的 Tauri Builder 中注册以下插件：`tauri-plugin-dialog`（文件夹选择对话框）、`tauri-plugin-fs`（文件系统读写）、`tauri-plugin-opener`（外部链接打开）。

#### Scenario: 插件注册成功
- **WHEN** 执行 `cargo build`
- **THEN** `tauri-plugin-dialog`、`tauri-plugin-fs`、`tauri-plugin-opener` 全部编译通过且注册到 Tauri Builder

### Requirement: Cargo 依赖配置
`Cargo.toml` SHALL 包含以下依赖：tauri（v2）、tauri-plugin-dialog（v2）、tauri-plugin-fs（v2）、tauri-plugin-opener（v2）、serde（v1 + derive feature）、serde_json（v1）、tokio（v1 + full feature）、image（v0.25）、kamadak-exif（v0.5）、rustdct（v0.7）、lru（v0.12）、md5（v0.7）、chrono（v0.4 + serde feature）、log（v0.4）、env_logger（v0.11）、thiserror（v2）、anyhow（v1）。

#### Scenario: Cargo 编译通过
- **WHEN** 执行 `cargo build`
- **THEN** 所有依赖成功解析下载并编译通过

### Requirement: npm 依赖配置
`package.json` SHALL 在 dependencies 中添加：zustand（^5）、react-router-dom（^7）、@tauri-apps/plugin-dialog（^2）、@tauri-apps/plugin-fs（^2）。devDependencies 中添加：vitest、@vitest/coverage-v8、@testing-library/react、@testing-library/jest-dom、jsdom。

#### Scenario: npm install 成功
- **WHEN** 执行 `npm install`
- **THEN** 所有依赖成功安装，无 peer dependency 冲突

### Requirement: 权限能力配置
`capabilities/default.json` SHALL 配置以下权限：core:default、core:window:allow-create、core:window:allow-close、core:window:allow-set-focus、opener:default、dialog:default、dialog:allow-open、fs:default、fs:allow-read、fs:allow-write、fs:allow-exists、fs:allow-mkdir、path:default、event:default。windows 数组 SHALL 包含 `welcome` 和 `main`。

#### Scenario: 权限满足功能需求
- **WHEN** 前端调用文件夹选择对话框
- **THEN** dialog:allow-open 权限 SHALL 允许操作执行

### Requirement: Welcome 窗口配置
`tauri.conf.json` 的 app.windows SHALL 配置一个窗口：label 为 `welcome`，title 为 `Bulbul`，width 为 600，height 为 450，resizable 为 false，center 为 true，decorations 为 true。

#### Scenario: Welcome 窗口尺寸正确
- **WHEN** 应用启动
- **THEN** Welcome 窗口尺寸 SHALL 为 600×450，不可调整大小
