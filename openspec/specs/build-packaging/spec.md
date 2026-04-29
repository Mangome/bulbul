## ADDED Requirements

### Requirement: 应用图标配置

系统 SHALL 提供完整的应用图标集：`icon.ico`（Windows）、`32x32.png`、`128x128.png`、`128x128@2x.png`、`icon.icns`（macOS）。图标设计 SHALL 体现摄影/图像处理工具的专业感。

#### Scenario: Windows 图标

- **WHEN** 构建 Windows 安装包
- **THEN** 应用程序图标 SHALL 使用 `icons/icon.ico`，在任务栏和桌面显示正确

#### Scenario: 多尺寸 PNG

- **WHEN** 打包流程读取图标
- **THEN** SHALL 找到 32x32、128x128、256x256 三种尺寸的 PNG 图标文件

### Requirement: Windows NSIS 安装器配置

`tauri.conf.json` 的 `bundle` 配置 SHALL 完善 Windows NSIS 安装器参数。

#### Scenario: 安装器元数据

- **WHEN** 构建 Windows 安装包
- **THEN** 安装器 SHALL 包含正确的 `productName`（Bulbul）、`version`、`identifier`（com.bulbul.app）、`copyright` 信息

#### Scenario: 安装器功能

- **WHEN** 用户运行安装器
- **THEN** SHALL 支持选择安装路径、创建桌面快捷方式、添加到开始菜单

### Requirement: 生产构建优化

`tauri.conf.json` 和 `Cargo.toml` SHALL 配置生产构建优化参数。

#### Scenario: Rust 发布模式优化

- **WHEN** 执行 `cargo tauri build`
- **THEN** Rust 代码 SHALL 使用 LTO + opt-level=3 编译，生成体积最小的二进制

#### Scenario: 前端产物优化

- **WHEN** 执行 `npm run build`
- **THEN** Vite SHALL 生成 tree-shaken + minified 的前端产物

### Requirement: 发布流程生成 updater 产物

基于 tag 的发布流程 SHALL 为当前支持的平台生成 updater 所需的安装包、签名文件和 `latest.json` 元数据，并将这些产物上传到对应 GitHub Release。

#### Scenario: 生成 Windows updater 产物

- **WHEN** 工作流构建 Windows 发布版本
- **THEN** GitHub Release SHALL 包含 Windows 安装包、对应 `.sig` 签名文件和可供 updater 使用的 `latest.json`

#### Scenario: 生成 macOS updater 产物

- **WHEN** 工作流构建 macOS Apple Silicon 发布版本
- **THEN** GitHub Release SHALL 包含 macOS updater 安装产物、对应 `.sig` 签名文件和可供 updater 使用的 `latest.json`

### Requirement: 发布流程使用签名密钥

发布流程 MUST 使用受保护的 updater 私钥对更新产物签名；当签名配置缺失时，流程 MUST 明确失败，而不是发布不可更新的资产。

#### Scenario: 签名配置完整

- **WHEN** GitHub Secrets 中存在 updater 私钥相关配置
- **THEN** 工作流 SHALL 生成带签名的更新产物并继续发布流程

#### Scenario: 签名配置缺失

- **WHEN** updater 私钥或必要环境变量缺失
- **THEN** 工作流 MUST 失败并给出可定位的错误信息

### Requirement: draft release 保持更新闸门

发布流程 SHALL 允许先生成 draft release；在 release 未正式发布前，客户端 MUST 不把该版本视为可更新目标。

#### Scenario: draft release 未进入更新通道

- **WHEN** 新版本 release 仍为 draft
- **THEN** 客户端通过“latest”更新端点 MUST 继续看到上一个已发布版本或无更新结果

#### Scenario: 发布 release 后进入更新通道

- **WHEN** draft release 被正式发布
- **THEN** 客户端后续检查更新 SHALL 能获取该版本的 `latest.json` 与对应平台更新资产
