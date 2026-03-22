## Why

Stage 2 已完成 NEF 文件解析与缓存系统，能够从 RAW 文件中提取嵌入 JPEG、解析 Exif 元数据并生成缩略图。但当前的处理流水线仅完成到「单文件处理」层面，**无法实现核心业务价值——自动将相似照片分组**。Stage 3 补齐 pHash 感知哈希计算、相似度比较、自动分组算法三个核心模块，并将 Stage 2 的模块串联为完整的端到端异步处理流水线（扫描 → NEF 处理 → pHash 计算 → 相似度分析 → 分组），同时在前端对接进度事件，让用户看到实时处理进度。

## What Changes

- **新增 pHash 感知哈希计算**：基于 DCT-II 变换实现 64-bit 感知哈希，支持图像相似度比较
- **新增汉明距离 + 相似度百分比计算**：包含 LRU 缓存避免重复计算
- **新增时间 + 相似度双条件分组算法**：顺序扫描 + 早期终止，将已排序的图片聚合为分组
- **升级 `process_commands.rs` 处理流水线**：从当前的「扫描 → NEF 处理」扩展为「扫描 → NEF 处理 → pHash 计算 → 分析 → 分组」完整流水线，返回 `GroupResult`
- **新增前端事件监听 Hook**：`useTauriEvents` 通用事件 Hook + `useProcessing` 处理流水线 Hook
- **新增前端进度对话框组件**：`ProgressDialog.tsx` 展示实时处理进度、当前文件、预估剩余时间
- **更新 `SessionState`**：存储 pHash 缓存和分组结果
- **更新前端 Store**：`useAppStore` 集成分组数据和完整进度状态流转

## Capabilities

### New Capabilities

- `phash-algorithm`: pHash 感知哈希计算（DCT-II + 9×8 灰度矩阵 + 64-bit hash 生成）
- `similarity-calculation`: 汉明距离 + 相似度百分比 + LRU 缓存
- `grouping-algorithm`: 时间 + 相似度双条件自动分组，顺序扫描 + 早期终止
- `processing-pipeline`: 完整端到端处理流水线（扫描 → 处理 → pHash → 分析 → 分组），tokio 并发 + 进度事件 + 取消支持
- `frontend-progress`: 前端进度事件对接（useTauriEvents hook、useProcessing hook、ProgressDialog 组件）

### Modified Capabilities

- `session-state`: 新增 pHash 缓存字段，存储分组结果
- `zustand-stores`: `useAppStore` 集成分组数据、进度状态流转、分组导航
- `ipc-services`: `processService` 更新为返回 `GroupResult`，事件监听格式对齐完整流水线

## Impact

- **Rust 代码**：新增 `core/phash.rs`、`core/similarity.rs`、`core/grouping.rs` 三个核心算法模块；重构 `commands/process_commands.rs` 为完整流水线；更新 `state/session.rs` 增加 pHash 缓存字段
- **前端代码**：新增 `hooks/useTauriEvents.ts`、`hooks/useProcessing.ts`、`components/dialogs/ProgressDialog.tsx`；更新 `stores/useAppStore.ts` 和 `services/processService.ts`；更新 `windows/MainPage.tsx` 集成进度对话框
- **依赖**：已有 `rustdct`（DCT 计算）、`lru`（LRU 缓存）、`chrono`（时间比较），无需新增依赖
- **IPC 接口**：`process_folder` 命令返回值从 `ProcessFolderResult` 变更为 `GroupResult`（**BREAKING**）
