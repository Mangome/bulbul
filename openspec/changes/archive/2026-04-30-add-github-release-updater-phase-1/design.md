## Context

Bulbul 当前已经具备基于 tag 的 GitHub Release 构建流程，并且版本号在 `package.json`、`src-tauri/Cargo.toml` 与 `src-tauri/tauri.conf.json` 之间保持同步。应用侧尚未接入 Tauri updater 能力，设置面板也没有版本信息或更新入口，因此“发布新版本”和“让已安装用户完成升级”之间仍然存在断层。

第一阶段的目标是最小化改造成本：继续复用 GitHub Releases 作为分发源，只提供手动检查更新与手动安装更新，不引入独立更新服务器、自动轮询、多通道发布或跳过版本等额外状态管理。当前工作流仅构建 Windows x64 与 macOS Apple Silicon，因此更新能力也仅承诺覆盖这两个已发布目标。

## Goals / Non-Goals

**Goals:**
- 在应用内提供手动检查更新、显示最新版信息、下载并安装更新的完整链路。
- 基于 GitHub Releases 提供 updater 所需的 `latest.json` 与签名安装包，不新增自建服务。
- 将更新入口集成到现有设置面板，保持主界面低干扰。
- 让发布流程在现有 tag/release 基础上可持续维护，并兼容“先 draft、后手动 publish”的审核节奏。

**Non-Goals:**
- 不实现启动时自动检查更新。
- 不实现 stable/beta 多通道切换。
- 不实现“跳过此版本”或更新提醒频率配置。
- 不扩展到当前未进入发布矩阵的平台与架构。
- 不处理 macOS 公证、代码签名或首次安装体验问题。

## Decisions

### 1. 使用 Tauri 官方 updater + process 插件，更新源指向 GitHub Release 的 `latest.json`
- **Decision**: 在 Rust 侧接入 `tauri-plugin-updater` 与 `tauri-plugin-process`，在前端接入 `@tauri-apps/plugin-updater` 与 `@tauri-apps/plugin-process`。`tauri.conf.json` 配置 updater endpoint 指向 GitHub Release 可下载的 `latest.json`。
- **Rationale**: 这是 Tauri 2 的官方方案，签名校验、平台匹配、下载与安装链路已封装完成，能够以最少自研逻辑复用当前 GitHub 发布体系。
- **Alternatives considered**:
  - 自建更新 API：更灵活，但会引入服务端部署与长期维护成本，不符合第一阶段“低运维成本”目标。
  - 前端直接请求 GitHub API 比较版本：只能做提示，无法替代 updater 所需的签名验证与安装流程。

### 2. 更新入口放在设置面板，采用“手动触发”交互
- **Decision**: 在 `SettingsPanel` 中新增“版本更新”区域，展示当前版本、检查更新按钮、可选的更新说明、下载/安装按钮和状态文本。
- **Rationale**: 设置面板已经是低频系统级操作入口，当前结构最适合承载版本信息与更新动作，且不会打断图片筛选主流程。
- **Alternatives considered**:
  - 顶部导航栏直接加按钮：入口更显眼，但会增加高频操作区域噪声，且空间已较紧张。
  - 应用启动即弹更新对话框：交互更强，但第一阶段尚未引入自动检查，不应先做强提醒。

### 3. 前端更新状态使用独立服务封装，暂不进入全局 store
- **Decision**: 新增更新服务层，封装 `check()`、`downloadAndInstall()`、`relaunch()` 调用；设置面板以组件局部状态管理“空闲 / 检查中 / 可更新 / 下载中 / 已完成 / 出错”等 UI 状态。
- **Rationale**: 第一阶段只有一个更新入口，且不涉及跨页面共享状态。局部状态比新增全局 store 更简单，也更容易测试。
- **Alternatives considered**:
  - 新增 Zustand store：适合自动检查、全局 badge、多入口提醒等后续阶段，但当前会增加不必要复杂度。

### 4. 发布流程继续保留 draft release，但只有 publish 后才进入更新通道
- **Decision**: 保留现有 `releaseDraft: true` 的人工审核流程；GitHub Actions 在 release 资产中生成 updater 产物与 `latest.json`，客户端始终读取 `releases/latest/download/latest.json`。只有当 release 被正式发布后，客户端才会看到该版本更新。
- **Rationale**: 这延续了现有“先检查、后发布”的节奏，同时无需引入额外 channel 机制。
- **Alternatives considered**:
  - 直接发布非 draft release：流程更简单，但会降低发布前人工校验的缓冲区。
  - 使用 prerelease 作为 beta 通道：第一阶段明确不做多通道。

### 5. 将 updater 相关发布要求收敛到工作流与配置文件，而不是应用运行时拼装
- **Decision**: 通过 `tauri.conf.json` 开启 `createUpdaterArtifacts`，通过 GitHub Actions 生成并上传签名安装包与 `latest.json`，通过 GitHub Secrets 注入私钥；应用运行时只消费最终 endpoint，不参与生成元数据。
- **Rationale**: 构建时生成的静态元数据更稳定、可回溯，也符合 GitHub Releases 作为静态分发源的使用方式。
- **Alternatives considered**:
  - 应用端动态拼装平台 URL：会绕开签名元数据约束，且难以保证行为与发布资产一致。

## Risks / Trade-offs

- **[签名密钥丢失或配置错误]** → 通过文档化 GitHub Secrets 配置、在 CI 中显式检查缺失变量、首次接入时用测试 tag 验证完整链路。
- **[draft release 导致客户端看不到新版本]** → 明确流程要求：只有 publish release 后才应验证客户端更新；在任务中加入发布后验收步骤。
- **[Windows/macOS 平台行为差异]** → 以 Tauri updater 官方默认行为为准，UI 文案仅做通用提示，验收分别覆盖 Windows x64 与 macOS Apple Silicon。
- **[设置面板状态过多导致实现分散]** → 统一由更新服务返回结构化结果，组件只渲染有限状态，避免逻辑散落在多个组件。
- **[GitHub Action 生成 `latest.json` 方式不稳定]** → 选择与当前 `tauri-action` 兼容的固定生成方案，并在设计中把产物校验纳入发布任务，而不是依赖隐式行为。

## Migration Plan

1. 生成 updater 签名密钥对，公钥写入仓库配置，私钥写入 GitHub Secrets。
2. 更新桌面端依赖、capabilities 与 `tauri.conf.json`，让本地构建可以生成 updater artifacts。
3. 调整 GitHub Release 工作流，确保发布时包含签名安装包、签名文件与 `latest.json`。
4. 在前端实现更新服务与设置面板更新区域，接通检查、下载、安装与重启流程。
5. 使用测试版本号和测试 tag 执行一次端到端验证：构建 release → publish release → 旧版本应用检查并安装更新。
6. 如需回滚，可回退到不含 updater 的应用版本，并停止发布新的 `latest.json` / updater 资产；客户端将只是不再检测到更新，不影响现有核心功能。

## Open Questions

- 当前阶段无阻塞性开放问题；实现时若发现 `tauri-action` 版本与 `latest.json` 生成方式存在差异，应在同一变更内固定为仓库实际可运行的方案。