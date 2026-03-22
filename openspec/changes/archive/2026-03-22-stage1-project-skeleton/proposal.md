## Why

项目当前为 `create-tauri-app` 生成的纯脚手架模板，仅有一个 `greet` 示例命令，没有任何业务代码。要启动 Bulbul（RAW 图像筛选与管理桌面应用）的开发，首先需要搭建完整的项目骨架——包括 Rust 后端模块结构、数据模型、全局状态管理、Tauri IPC 通路，以及前端目录结构、路由、状态管理和 IPC 服务封装。这是所有后续阶段（NEF 解析、pHash 分组、画布渲染等）的基础，必须先完成。

## What Changes

- **Rust 后端模块结构**：建立 `commands/`、`core/`、`models/`、`state/`、`utils/` 模块目录及入口文件
- **Rust 数据模型**：实现 `ImageMetadata`、`GroupData`/`GroupResult`、`ProcessingState`/`ProcessingProgress`、`AppError` 四组核心数据结构
- **Rust 全局状态**：实现 `SessionState`（`Arc<Mutex<...>>`）用于跨 Command 共享状态
- **Rust 基础 IPC Commands**：实现 `select_folder`、`get_folder_info`、`scan_raw_files` 等文件操作命令，以及 `open_main_window` 窗口管理命令
- **Tauri 配置升级**：多窗口配置（Welcome 600×450 + Main 动态创建）、权限/能力扩展、Tauri 插件集成（dialog、fs、opener）
- **Cargo 依赖完善**：添加 tokio、image、kamadak-exif、rustdct、lru、md5、chrono、thiserror、anyhow 等依赖
- **前端目录结构**：建立 `windows/`、`components/`、`stores/`、`services/`、`hooks/`、`types/`、`styles/` 完整目录
- **前端路由**：基于 `react-router-dom` 实现 Welcome/Main 双窗口页面路由
- **前端状态管理**：基于 Zustand 实现 `useAppStore`、`useCanvasStore`、`useSelectionStore` 三个 Store
- **前端 IPC 服务层**：封装 `fileService`、`processService`、`imageService`、`exportService` 四个服务模块
- **前端 TypeScript 类型**：定义与 Rust 数据模型对应的完整类型系统
- **npm 依赖添加**：zustand、react-router-dom、@tauri-apps/plugin-dialog、@tauri-apps/plugin-fs 等
- **全局样式**：CSS 变量系统 + 基础全局样式

## Capabilities

### New Capabilities

- `rust-module-structure`: Rust 后端模块骨架（commands/core/models/state/utils 目录结构与 mod.rs）
- `data-models`: 核心数据模型定义（ImageMetadata、GroupData、ProcessingState、AppError）
- `session-state`: Rust 全局会话状态管理（SessionState + Arc<Mutex> 共享）
- `file-commands`: 文件夹选择/扫描/校验 IPC 命令
- `window-management`: 多窗口生命周期管理（Welcome → Main 窗口切换）
- `tauri-config`: Tauri 配置、权限、插件集成
- `frontend-structure`: 前端目录结构、路由、入口配置
- `zustand-stores`: Zustand 状态管理（AppStore、CanvasStore、SelectionStore）
- `ipc-services`: 前端 IPC 服务封装层（file/process/image/export）
- `frontend-types`: TypeScript 类型定义系统

### Modified Capabilities

（无已有能力需要修改）

## Impact

- **Rust 端**：`lib.rs` 重写为 Tauri Builder + 插件注册 + Command 注册；新增 ~700 行 Rust 代码分布在 models/state/commands/core/utils 模块
- **前端**：`App.tsx` 和 `main.tsx` 重写；新增 ~700 行 TypeScript/React 代码分布在 windows/stores/services/types/styles
- **配置文件**：`Cargo.toml` 新增 ~15 个依赖；`package.json` 新增 ~6 个依赖；`tauri.conf.json` 重写窗口配置；`capabilities/default.json` 扩展权限
- **构建**：需要 `cargo build` 重新编译全部 Rust 依赖
- **删除**：移除脚手架模板的 `greet` 命令和 `App.css` 示例样式
