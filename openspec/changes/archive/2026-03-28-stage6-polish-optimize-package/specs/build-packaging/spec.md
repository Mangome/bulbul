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
