## Why

应用长期使用后，磁盘缓存（medium + thumbnail 图片）会持续增长且无法清理，导致磁盘空间浪费。同时，当前设置分散在顶栏多个按钮中（分组参数在 popover、检测框是独立按钮、省份选择器是另一个 popover），缺乏统一的设置入口，用户难以找到和管理应用配置。

## What Changes

- 新增右侧滑出**设置面板**，作为统一的设置入口
- 将**分组参数**（相似度阈值、时间间隔）从 TopNavBar popover 迁移到设置面板中
- 将**检测框覆盖层开关**迁移到设置面板中
- 新增**缓存管理**功能：显示缓存目录路径、磁盘占用大小和文件数
- 新增**一键清理缓存**功能，清理后自动重新处理当前已打开的目录
- TopNavBar 简化：移除分组参数 popover 和检测框按钮，新增设置按钮（齿轮图标）

## Capabilities

### New Capabilities
- `settings-panel`: 设置面板 UI 组件，包含分组参数、外观设置、缓存管理三个区域
- `cache-management`: 缓存大小查询和一键清理功能（Rust IPC 命令 + 前端服务 + 清理后自动重处理）

### Modified Capabilities
- `file-cache`: 新增缓存大小计算（`get_cache_size`）和全量清理（`clear_all_cache`）函数
- `grouping-settings`: 从 TopNavBar popover 迁移到设置面板，交互方式变更
- `detection-overlay-toggle`: 从 TopNavBar 独立按钮迁移到设置面板

## Impact

- **Rust 后端**：`cache.rs` 新增 2 个函数，新增 `cache_commands.rs` 模块，`lib.rs` 注册 2 个新 IPC 命令
- **前端组件**：TopNavBar 精简（移除 popover + 检测框按钮），新增 SettingsPanel 组件
- **前端服务**：新增 `cacheService.ts` 封装缓存 IPC 调用
- **数据流**：缓存清理后需清空 ImageBitmap 内存缓存并触发 `process_folder` 重新处理
- **跨平台**：macOS 缓存路径由 Tauri 自动处理，无需额外适配
