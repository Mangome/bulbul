## 1. Agent C — 配置集成（最先启动，无依赖）

> **可与 Agent A、Agent B 完全并行**。Agent C 的产出是 A/B 的编译/安装前提，应最先完成。

- [x] 1.1 更新 `Cargo.toml`：添加 tauri-plugin-dialog(v2)、tauri-plugin-fs(v2)、tokio(v1, full)、image(v0.25)、kamadak-exif(v0.5)、rustdct(v0.7)、lru(v0.12)、md5(v0.7)、chrono(v0.4, serde)、log(v0.4)、env_logger(v0.11)、thiserror(v2)、anyhow(v1) 依赖
- [x] 1.2 更新 `package.json`：dependencies 添加 zustand(^5)、react-router-dom(^7)、@tauri-apps/plugin-dialog(^2)、@tauri-apps/plugin-fs(^2)；devDependencies 添加 vitest、@vitest/coverage-v8、@testing-library/react、@testing-library/jest-dom、jsdom
- [x] 1.3 重写 `tauri.conf.json`：配置 Welcome 窗口（label: welcome, title: Bulbul, 600×450, resizable: false, center: true, decorations: true），保留 build/bundle/security 配置
- [x] 1.4 更新 `capabilities/default.json`：windows 数组改为 ["welcome", "main"]，permissions 扩展为 core:default、core:window:allow-create、core:window:allow-close、core:window:allow-set-focus、opener:default、dialog:default、dialog:allow-open、fs:default、fs:allow-read、fs:allow-write、fs:allow-exists、fs:allow-mkdir、path:default、event:default
- [x] 1.5 执行 `npm install` 验证前端依赖安装成功
- [x] 1.6 执行 `cargo build` 验证 Rust 依赖编译通过

## 2. Agent A — Rust 骨架（可与 Agent B 完全并行）

> **依赖 Agent C 的 Cargo.toml 完成后才能编译**，但可在 C 工作的同时编写代码。与 Agent B 完全并行，通过数据模型约定对齐。

### 2.1 模块结构搭建

- [x] 2.1.1 创建 `src-tauri/src/models/mod.rs`，声明子模块 image_metadata、group_data、processing、error
- [x] 2.1.2 创建 `src-tauri/src/models/image_metadata.rs`：定义 ImageMetadata 结构体（所有字段 Option<T>），派生 Debug/Clone/Serialize/Deserialize/Default
- [x] 2.1.3 创建 `src-tauri/src/models/group_data.rs`：定义 GroupData、GroupResult、PerformanceMetrics 结构体
- [x] 2.1.4 创建 `src-tauri/src/models/processing.rs`：定义 ProcessingState 枚举（9 变体, serde rename_all snake_case）和 ProcessingProgress 结构体
- [x] 2.1.5 创建 `src-tauri/src/models/error.rs`：定义 AppError 枚举（thiserror），实现 serde::Serialize

### 2.2 状态管理

- [x] 2.2.1 创建 `src-tauri/src/state/mod.rs`，声明 session 子模块
- [x] 2.2.2 创建 `src-tauri/src/state/session.rs`：定义 SessionState 结构体（含 cancel_flag: Arc<AtomicBool>），实现 new()/default()

### 2.3 命令层

- [x] 2.3.1 创建 `src-tauri/src/commands/mod.rs`，声明子模块并 pub use 导出所有命令函数
- [x] 2.3.2 创建 `src-tauri/src/commands/file_commands.rs`：实现 select_folder（dialog 插件调用）、get_folder_info（遍历目录统计 .nef 文件数）、scan_raw_files（扫描 .nef 文件返回路径列表）
- [x] 2.3.3 在 `file_commands.rs` 中定义 FolderInfo 和 ScanResult 辅助结构体
- [x] 2.3.4 创建 `src-tauri/src/commands/window_commands.rs`：实现 open_main_window（WebviewWindowBuilder 动态创建 1200×900 Main 窗口 + 关闭 Welcome 窗口），处理窗口已存在时的重用逻辑
- [x] 2.3.5 创建 `src-tauri/src/commands/process_commands.rs`（空壳，仅声明 process_folder 和 cancel_processing 函数签名，返回 todo!()）
- [x] 2.3.6 创建 `src-tauri/src/commands/image_commands.rs`（空壳，声明 get_image_url、get_metadata、get_batch_metadata 签名）
- [x] 2.3.7 创建 `src-tauri/src/commands/export_commands.rs`（空壳，声明 select_export_dir、export_images 签名）

### 2.4 核心模块与工具（空壳）

- [x] 2.4.1 创建 `src-tauri/src/core/mod.rs`，声明 raw_processor、metadata、phash、similarity、grouping、nef_parser 子模块
- [x] 2.4.2 创建 core/ 下 6 个空壳 .rs 文件（raw_processor.rs、metadata.rs、phash.rs、similarity.rs、grouping.rs、nef_parser.rs），每个文件包含模块注释说明用途
- [x] 2.4.3 创建 `src-tauri/src/utils/mod.rs`，声明 cache、paths 子模块
- [x] 2.4.4 创建 utils/ 下 2 个空壳 .rs 文件（cache.rs、paths.rs）

### 2.5 入口集成

- [x] 2.5.1 重写 `src-tauri/src/lib.rs`：注册三个 Tauri 插件（dialog/fs/opener）+ .manage(Arc::new(Mutex::new(SessionState::new()))) + invoke_handler 注册所有已实现的 commands
- [x] 2.5.2 更新 `src-tauri/src/main.rs`（保持不变或微调）
- [x] 2.5.3 执行 `cargo build` 验证全部编译通过

### 2.6 Rust 单元测试

- [x] 2.6.1 在 `models/image_metadata.rs` 中添加测试：序列化/反序列化往返、默认值全为 None、部分字段 JSON 反序列化
- [x] 2.6.2 在 `models/group_data.rs` 中添加测试：GroupData 序列化往返、GroupResult 字段一致性
- [x] 2.6.3 在 `models/processing.rs` 中添加测试：ProcessingState snake_case 序列化、ProcessingProgress 完整序列化
- [x] 2.6.4 在 `models/error.rs` 中添加测试：各 AppError 变体序列化为正确的错误消息字符串、IoError 自动转换
- [x] 2.6.5 在 `state/session.rs` 中添加测试：SessionState 初始状态验证（所有 HashMap 为空、processing_state 为 Idle、cancel_flag 为 false）
- [x] 2.6.6 在 `commands/file_commands.rs` 中添加测试：get_folder_info 和 scan_raw_files 的逻辑验证（使用临时目录创建测试文件）
- [x] 2.6.7 执行 `cargo test --workspace` 验证全部测试通过

## 3. Agent B — 前端骨架（可与 Agent A 完全并行）

> **依赖 Agent C 的 package.json 完成后才能安装依赖**，但可在 C 工作的同时编写代码。与 Agent A 完全并行，通过 types/index.ts 的数据类型约定对齐。

### 3.1 类型定义（接口约定，最先编写）

- [x] 3.1.1 创建 `src/types/index.ts`：定义 ImageMetadata 接口（所有字段 camelCase，可选字段为 T | null）
- [x] 3.1.2 在 types/index.ts 中定义 GroupData、GroupResult、PerformanceMetrics 接口
- [x] 3.1.3 在 types/index.ts 中定义 ProcessingState 类型（字符串字面量联合）和 ProcessingProgress 接口
- [x] 3.1.4 在 types/index.ts 中定义 FolderInfo、ScanResult、ExportResult 接口

### 3.2 样式系统

- [x] 3.2.1 创建 `src/styles/variables.css`：定义 CSS 变量（主色调 #3B82F6、成功色、警告色、危险色、选中态、面板样式、间距系统）
- [x] 3.2.2 创建 `src/styles/global.css`：导入 variables.css，定义全局重置（box-sizing: border-box、body margin: 0、系统字体栈、基础滚动条样式）
- [x] 3.2.3 更新 `src/main.tsx`：导入 global.css 替换原有样式

### 3.3 IPC 服务层

- [x] 3.3.1 创建 `src/services/fileService.ts`：封装 selectFolder()、getFolderInfo(path)、scanRawFiles(path)
- [x] 3.3.2 创建 `src/services/processService.ts`：封装 processFolder(folderPath, options?)、cancelProcessing()、onProgress/onCompleted/onFailed 事件监听
- [x] 3.3.3 创建 `src/services/imageService.ts`：封装 getImageUrl(hash, size)（含 convertFileSrc）、getMetadata(hash)、getBatchMetadata(hashes)
- [x] 3.3.4 创建 `src/services/exportService.ts`：封装 selectExportDir()、exportImages(hashes, targetDir)

### 3.4 Zustand Store

- [x] 3.4.1 创建 `src/stores/useAppStore.ts`：实现应用主 Store（currentFolder、folderInfo、groups、processingState、progress + setFolder/setGroups/selectGroup/navigateGroup/setProcessingState/updateProgress/reset）
- [x] 3.4.2 创建 `src/stores/useCanvasStore.ts`：实现画布状态 Store（zoomLevel/viewportX/viewportY + setZoom 限制 0.1~3.0 / zoomIn/zoomOut/fitToWindow/resetZoom）
- [x] 3.4.3 创建 `src/stores/useSelectionStore.ts`：实现选中状态 Store（selectedHashes Set + toggleSelection/clearSelection/getSelectedInGroup）

### 3.5 窗口页面

- [x] 3.5.1 创建 `src/windows/WelcomePage.tsx`：应用标题 + 简介 + 「选择文件夹」按钮，点击调用 fileService.selectFolder() + open_main_window
- [x] 3.5.2 创建 `src/windows/MainPage.tsx`：占位页面，显示 "Bulbul 主工作区" + 当前文件夹路径信息
- [x] 3.5.3 重写 `src/App.tsx`：获取 Tauri 窗口 label，根据 label 渲染 WelcomePage/MainPage/错误页面
- [x] 3.5.4 更新 `src/main.tsx`：导入新的全局样式，清理脚手架代码
- [x] 3.5.5 删除 `src/App.css`（脚手架样式，不再需要）

### 3.6 目录骨架（空壳文件）

- [x] 3.6.1 创建组件目录占位文件：`src/components/canvas/.gitkeep`、`src/components/panels/.gitkeep`、`src/components/dialogs/.gitkeep`、`src/components/common/.gitkeep`
- [x] 3.6.2 创建 hooks 目录占位文件：`src/hooks/.gitkeep`
- [x] 3.6.3 创建 utils 目录占位文件：`src/utils/.gitkeep`

### 3.7 前端单元测试

- [x] 3.7.1 配置 vitest：创建 `vitest.config.ts`（environment: jsdom, coverage provider: v8）
- [x] 3.7.2 创建 `src/stores/useAppStore.test.ts`：测试初始状态、setFolder、setGroups、navigateGroup 循环、reset
- [x] 3.7.3 创建 `src/stores/useCanvasStore.test.ts`：测试初始状态、setZoom 范围限制（上限 3.0 / 下限 0.1）、zoomIn/zoomOut 步进
- [x] 3.7.4 创建 `src/stores/useSelectionStore.test.ts`：测试 toggleSelection 选中/取消、clearSelection、getSelectedInGroup 计数
- [x] 3.7.5 创建 `src/services/fileService.test.ts`：mock @tauri-apps/api/core，验证 invoke 调用参数正确
- [x] 3.7.6 创建 `src/services/processService.test.ts`：mock invoke 和 listen，验证调用参数和默认值
- [x] 3.7.7 创建 `src/services/imageService.test.ts`：mock invoke 和 convertFileSrc，验证 URL 转换逻辑
- [x] 3.7.8 创建 `src/services/exportService.test.ts`：mock invoke，验证调用参数
- [x] 3.7.9 执行 `npx vitest run` 验证全部前端测试通过

## 4. 集成验证（需要 Agent A + B + C 全部完成后）

> 此阶段是三个 Agent 产出的最终集成验证。

- [x] 4.1 执行 `cargo build` 确认 Rust 全量编译通过
- [x] 4.2 执行 `cargo test --workspace` 确认所有 Rust 测试通过
- [x] 4.3 执行 `npx vitest run` 确认所有前端测试通过
- [x] 4.4 执行 `npm run tauri dev` 验证应用启动后显示 Welcome 窗口（600×450）
- [x] 4.5 在 Welcome 窗口点击「选择文件夹」验证系统对话框弹出
- [x] 4.6 选择文件夹后验证 Welcome 窗口关闭、Main 窗口（1200×900）创建并显示
- [x] 4.7 验证前端 TypeScript 类型与 Rust 数据模型 JSON 序列化对齐（字段名一致性检查）
