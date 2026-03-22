## Context

Bulbul 是一款基于 Tauri v2 的 RAW 图像筛选与管理桌面应用。Stage 1 完成了项目骨架（双窗口、IPC 通路、Zustand Store），Stage 2 完成了 NEF 解析核心（TIFF IFD 解析、嵌入 JPEG 提取、Exif 元数据、缩略图生成、文件缓存）。

当前状态：
- `core/phash.rs`、`core/similarity.rs`、`core/grouping.rs` 已创建占位文件，待实现
- `commands/process_commands.rs` 已实现扫描 + NEF 并发处理 + 进度推送，但尚未集成 pHash 和分组
- `process_folder` 返回 `ProcessFolderResult`（含 `Vec<ProcessResult>`），需要升级为返回 `GroupResult`
- 前端 `MainPage.tsx` 已有基础的进度展示，但缺少独立的进度对话框和 Hook 抽象
- 已有 `rustdct`、`lru`、`image`、`chrono` 等依赖，无需新增 crate

约束：
- pHash 算法必须与技术需求文档一致：9×8 灰度矩阵 → 2D DCT-II → 8×8 低频系数 → 64-bit hash
- 分组算法使用顺序扫描 + 早期终止（已按时间排序），非 O(n²) 全量比较
- 并发度固定 8 路（Semaphore），需支持取消信号（`cancel_flag`）
- pHash 计算基于 200px 缩略图（已缓存），非原始 RAW 文件

## Goals / Non-Goals

**Goals:**
- 实现完整的 pHash 感知哈希计算，相同图片产生相同 hash，相似图片汉明距离小
- 实现汉明距离 + 相似度百分比计算，带 LRU 缓存避免重复计算
- 实现时间 + 相似度双条件分组算法，输出 `GroupResult`
- 将 `process_folder` 升级为完整端到端流水线，各阶段（Scanning → Processing → Analyzing → Grouping → Completed）推送进度事件
- 前端实现 `useTauriEvents`、`useProcessing` Hook 和 `ProgressDialog` 组件

**Non-Goals:**
- 不做分组参数的 UI 配置（使用默认值 `similarity_threshold=90.0`，`time_gap_seconds=10`）
- 不做 pHash 持久化到磁盘（仅内存 LRU 缓存，应用重启后重新计算）
- 不做画布渲染和图片展示（Stage 4 职责）
- 不做导出功能（Stage 5 职责）

## Decisions

### 1. pHash 算法实现方式

**选择**：使用 `rustdct` 的 DCT-II 实现，手动完成 9×8 → 2D DCT → 64-bit hash 的全流程。

**备选方案**：
- A) 使用第三方 pHash 库（如 `img_hash` crate）— 放弃，因为需要精确控制算法细节以确保与技术需求对齐，且减少外部依赖
- B) 手写 DCT — 放弃，`rustdct` 已经是高性能的 Rust 纯实现，无需重造轮子

**理由**：`rustdct` 仅提供 DCT 变换基础能力，其余逻辑（灰度缩放、矩阵构建、阈值判定、hash 生成）均为自定义实现，保持完全可控。

### 2. 相似度 LRU 缓存的键设计

**选择**：使用有序 hash pair `"{min_hash}:{max_hash}"` 作为缓存 key，其中 hash 指 `compute_path_hash` 产生的文件路径 MD5（非 pHash 值）。

**理由**：
- 字符串 key 确保 `(A, B)` 和 `(B, A)` 命中同一缓存条目
- 使用文件路径 hash 而非 pHash 值避免 u64 碰撞问题
- LRU 容量设为 1000，足够覆盖顺序扫描时的热点对

### 3. 流水线阶段分离

**选择**：将 `process_folder` 重构为 4 个清晰阶段，每个阶段对应一个 `ProcessingState`：

```
Scanning → Processing → Analyzing → Grouping → Completed
(扫描 NEF)  (提取 JPEG)  (pHash 计算)  (分组)     (完成)
```

**备选方案**：
- A) 在 Processing 阶段同步计算 pHash — 放弃，因为 pHash 需要读取已缓存的缩略图，将 Processing 和 Analyzing 合并会使进度信息不够精确
- B) 每个阶段作为独立 Command — 放弃，因为需要前端多次调用增加复杂度，且中间状态在 Rust 侧即可管理

**理由**：分阶段推送进度让用户清楚知道当前在做什么（正在处理 NEF / 正在计算相似度 / 正在分组），且各阶段可独立优化。

### 4. pHash 计算的并发策略

**选择**：pHash 计算（Analyzing 阶段）使用 `tokio::task::spawn_blocking` + Semaphore 并发控制，与 Processing 阶段共用相同的并发度（8 路）。

**理由**：pHash 计算涉及图像解码（CPU 密集型），必须在 blocking 线程池中执行。200px 缩略图的 pHash 计算预计 <10ms/张，千级别图片总耗时可控。

### 5. 前端进度对话框触发策略

**选择**：当处理状态非 `idle`/`completed` 时始终显示 `ProgressDialog`，无文件数阈值限制。

**备选方案**：技术需求文档建议文件数 >10 才显示 — 放弃，因为 MVP 阶段简化逻辑，始终显示更可靠。

**理由**：用户选择了文件夹就会触发处理，始终展示进度条是更好的 UX 反馈。

### 6. process_folder 返回值变更

**选择**：`process_folder` 返回 `GroupResult`（包含分组数据 + 性能指标），**BREAKING** 变更。

**理由**：前端需要分组数据来驱动后续 Stage 4 的画布渲染。`ProcessFolderResult` 仅包含处理结果列表，无法满足需求。当前没有外部消费者，破坏性变更成本为零。

## Risks / Trade-offs

- **[pHash 精度]** DCT 精度可能因浮点实现差异导致 hash 不稳定 → 使用 f64 全程计算，单元测试验证相同图片产生相同 hash
- **[分组质量]** 顺序扫描 + 早期终止可能遗漏非连续的相似图片 → 可接受，因为图片已按拍摄时间排序，非连续的相似图片本身就不太可能是同一组连拍
- **[LRU 缓存容量]** 1000 条可能不足以覆盖大文件夹 → 顺序扫描模式下每张图片只与后续少量图片比较（早期终止），实际缓存压力远小于 O(n²)
- **[内存占用]** pHash 计算需要加载缩略图到内存 → 200px 缩略图约 30-50KB/张，Semaphore 限制最多 8 张并发，峰值 <1MB
- **[进度精度]** elapsed_ms 和 estimated_remaining_ms 需要计时逻辑 → 使用 `std::time::Instant` 在流水线开始时记录起始时间，每阶段记录耗时
