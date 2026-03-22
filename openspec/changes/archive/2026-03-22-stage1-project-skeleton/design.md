## Context

Bulbul 项目当前为 `create-tauri-app` 生成的纯脚手架模板，仅包含：
- Rust 端：`main.rs` + `lib.rs`（含 `greet` 示例命令）+ `tauri-plugin-opener` 依赖
- 前端：`App.tsx` + `main.tsx`（含 greet 示例 UI）+ React 18 + Vite 6
- 配置：单窗口 800×600，仅 `core:default` + `opener:default` 权限

本变更需要将这个空壳转变为具备完整模块结构、数据模型、双窗口架构、IPC 通路的可运行项目骨架，为后续 NEF 解析（Stage 2）、pHash 分组（Stage 3）、画布渲染（Stage 4）等阶段提供基础。

**约束**：
- 技术栈锁定：Tauri v2 + React 18 + TypeScript 5.6 + Zustand 5 + Rust 2021 edition
- 代码量控制在 ~2000 行（Rust ~1100 行，前端 ~900 行）
- 需支持 3 个 Agent 并行开发

## Goals / Non-Goals

**Goals:**
- 建立 Rust 后端完整模块目录结构（commands/core/models/state/utils）
- 定义所有核心数据模型（ImageMetadata、GroupData、ProcessingState、AppError），序列化/反序列化完备
- 实现 SessionState 全局状态管理（Arc<Mutex> 共享）
- 搭建 Welcome → Main 双窗口生命周期管理
- 实现文件夹选择/信息查询/RAW 文件扫描三个基础 IPC 命令
- 建立前端完整目录结构和路由体系
- 实现 Zustand Store（AppStore + CanvasStore + SelectionStore）初始状态和基础 actions
- 封装 IPC 服务层（fileService/processService/imageService/exportService）
- 定义完整 TypeScript 类型系统与 Rust 模型对齐
- 配置 Tauri 插件（dialog/fs/opener）和权限能力
- 所有代码须配套单元测试

**Non-Goals:**
- 不实现 NEF 文件解析逻辑（Stage 2）
- 不实现 pHash 算法和分组逻辑（Stage 3）
- 不实现 PixiJS 画布渲染（Stage 4）
- 不实现导出功能（Stage 5）
- 不做视觉设计和 UI 打磨（Stage 6）
- 不处理暗色主题
- 前端 `core/` 模块（raw_processor/phash/similarity/grouping/metadata/nef_parser）仅创建空壳 mod.rs，不实现具体逻辑

## Decisions

### 决策 1：三 Agent 并行架构与依赖关系

**选择**：将工作分为三条独立路径——Agent A（Rust 骨架）、Agent B（前端骨架）、Agent C（配置集成），通过"约定接口"解耦并行。

**理由**：
- Agent A 和 Agent B 通过 `types/index.ts` ↔ `models/` 的数据结构约定实现完全并行，双方只需保持字段名和类型一致
- Agent C 的配置输出（Cargo.toml 依赖、package.json 依赖、tauri.conf.json）是 A/B 的编译前提，但配置工作量小且可最先完成
- 三者操作完全不同的文件集，无合并冲突风险

**替代方案**：
- 顺序开发（C → A → B）：无冲突但耗时 3 倍，不采用
- 两路并行（Rust / Frontend）：配置散入两端增加协调成本

**并行依赖图**：
```
Agent C（配置集成）─── 最先启动，最先完成
    │
    ├──→ Agent A（Rust 骨架）── 在 C 完成 Cargo.toml 后开始编译
    │                           但可提前编写代码
    │
    └──→ Agent B（前端骨架）── 在 C 完成 package.json 后安装依赖
                               但可提前编写代码
    
Agent A ∥ Agent B：完全并行，通过数据模型约定对齐
```

### 决策 2：SessionState 使用 Arc<Mutex<>> 而非 RwLock

**选择**：`tauri::State<Arc<Mutex<SessionState>>>`

**理由**：
- Stage 1 的 IPC 命令访问模式为低频读写（用户触发），锁竞争可忽略
- Mutex 语义简单，避免 RwLock 的读写混淆
- 后续如遇性能瓶颈可无缝切换为 RwLock（接口不变）

**替代方案**：
- `RwLock`：过早优化，增加认知成本
- `DashMap` 拆分字段：拆分状态破坏一致性语义

### 决策 3：前端路由策略——基于窗口 label 而非 URL

**选择**：通过 Tauri 窗口 label（`welcome` / `main`）决定渲染内容，而非传统 URL 路由

**理由**：
- Tauri 多窗口共用同一个前端入口点（`index.html`），但窗口 label 不同
- 在 `App.tsx` 中通过 `window.__TAURI__.window.getCurrent().label` 判断当前窗口，渲染对应页面
- 比 react-router-dom 的路由更贴合 Tauri 多窗口模型（每个窗口是独立的 WebView）

**替代方案**：
- 多入口 HTML：Tauri 不原生支持，需要自定义构建
- URL hash 路由：可用但多了一层不必要的抽象

### 决策 4：MainWindow 通过 Rust 端动态创建

**选择**：Welcome 窗口在 `tauri.conf.json` 静态配置，MainWindow 通过 `WebviewWindowBuilder` 在 Rust 端动态创建

**理由**：
- MainWindow 的创建时机取决于用户选择文件夹的动作，属于业务逻辑
- 动态创建允许传递初始参数（如文件夹路径）
- 与技术需求文档一致

**替代方案**：
- 两个窗口都静态配置 + 显示/隐藏：需要预加载 MainWindow 资源，浪费内存

### 决策 5：IPC 错误返回 String 而非自定义结构

**选择**：Tauri Commands 的 Result 错误类型统一为 `String`，由 `AppError` 通过 `Serialize` trait 转为字符串

**理由**：
- Tauri v2 的 Command 返回错误需要实现 `Serialize`，`thiserror` 的 `Error` trait 与 `Serialize` 不能自动兼容
- 使用 `impl Serialize for AppError` 手动序列化为错误消息字符串，前端通过字符串判断错误类型
- 简洁且够用，后续可升级为结构化错误

**替代方案**：
- 自定义 `{ code, message }` 结构：过度设计，MVP 阶段不需要

### 决策 6：前端 Store 拆分为 3 个独立 Store

**选择**：`useAppStore`（应用主状态）、`useCanvasStore`（画布状态）、`useSelectionStore`（选中状态）三个独立 Zustand Store

**理由**：
- 关注点分离：画布缩放/平移高频变化不影响应用全局 re-render
- 选中状态独立管理，便于跨组件访问
- Zustand 天然支持多 Store，订阅粒度更细

**替代方案**：
- 单一大 Store + selector：状态耦合，任意变更触发全量 diff

## Risks / Trade-offs

- **[窗口 label 判断可靠性]** → 在 `App.tsx` 初始化时尽早获取 label 并缓存，添加 fallback 渲染（unknown window 显示错误提示）
- **[Cargo 依赖编译耗时]** → 首次 `cargo build` 需要下载编译 ~15 个依赖（tokio/image 等），预计 5-10 分钟。后续增量编译很快。Agent C 应尽早完成 Cargo.toml 以便 Agent A 尽早触发编译
- **[TypeScript 类型与 Rust 模型不同步]** → 建立命名约定：Rust `snake_case` ↔ TypeScript `camelCase`，通过 Serde `rename_all` 保证 JSON 一致性。Stage 1 交付时进行一次全量对齐检查
- **[Zustand Store 初始状态测试覆盖]** → 每个 Store 必须有初始状态快照测试 + action 状态变更测试，确保后续阶段可安全扩展
