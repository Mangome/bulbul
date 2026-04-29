## ADDED Requirements

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