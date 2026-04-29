## Why

Bulbul 已经开源到 GitHub，并且现有发布流程已经基于 tag 构建 GitHub Releases，但用户升级仍然需要手动关注新版本并重新下载安装包。现在补上基于 GitHub Releases 的应用内更新能力，可以把现有发布链路直接转化为可感知、可安装的桌面更新流程，优先以最低运维成本完成第一阶段落地。

## What Changes

- 为桌面应用新增第一阶段版本更新能力：用户可在应用内手动检查是否有新版本。
- 当 GitHub Releases 上存在适配当前平台的新版本时，应用显示版本号、更新说明，并支持下载并安装更新。
- 将更新入口放入设置面板，展示当前版本与更新状态，不在第一阶段引入启动时自动检查、跳过版本或多通道更新。
- 扩展 Tauri 配置、能力权限与前后端依赖，接入 updater / process 插件。
- 扩展 GitHub Release 工作流，生成并发布 updater 所需的签名产物与 `latest.json` 元数据，供客户端读取。

## Capabilities

### New Capabilities
- `desktop-updater`: 提供基于 GitHub Releases 的手动检查更新、下载更新和安装更新能力。

### Modified Capabilities
- `settings-panel`: 设置面板新增版本更新区域，展示当前版本、检查更新入口、更新状态与安装动作。
- `build-packaging`: 发布流程生成并上传 updater 所需的签名安装包和 `latest.json` 元数据。
- `tauri-config`: Tauri 配置新增 updater 插件、权限、公钥和更新端点，并生成 updater artifacts。

## Impact

- 前端 UI：`src/components/panels/SettingsPanel.tsx`、相关样式文件、可能新增更新服务与状态管理。
- 桌面端配置：`package.json`、`src-tauri/Cargo.toml`、`src-tauri/src/lib.rs`、`src-tauri/capabilities/default.json`、`src-tauri/tauri.conf.json`。
- 发布流程：`.github/workflows/release.yml`，以及 GitHub Secrets 中的 updater 签名私钥。
- 运行约束：第一阶段仅覆盖当前已发布的目标平台，不引入自动轮询或 beta/stable 多通道。