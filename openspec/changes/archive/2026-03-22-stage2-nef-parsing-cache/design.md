## Context

Bulbul 是一个 Tauri v2 + React + Rust 架构的 RAW 图像筛选桌面应用。Stage 1 已完成：双窗口骨架、数据模型（`ImageMetadata`、`GroupData`、`ProcessingState` 等）、`SessionState` 全局状态管理、文件夹选择/扫描 Commands、前端 Zustand Stores 和 IPC 服务层。

当前 `core/` 下 6 个模块和 `utils/` 下 2 个模块均为空壳占位。`process_folder`、`get_image_url`、`get_metadata` 等 Commands 标记为 `todo!()`。Cargo.toml 中 `image`、`kamadak-exif`、`md5`、`chrono`、`lru` 依赖已声明但未使用。

Stage 2 需要在这些空壳基础上实现完整的 NEF 解析 → JPEG 提取 → Exif 解析 → 缩略图生成 → 文件缓存流水线。

## Goals / Non-Goals

**Goals:**

- 实现 Nikon NEF 文件的 TIFF IFD 链解析，正确提取最大嵌入 JPEG
- 使用 `kamadak-exif` 解析 Exif 元数据到已定义的 `ImageMetadata` 结构
- 生成 200px 宽 Lanczos3 缩略图并缓存到本地文件系统
- 实现 MD5 路径哈希 + 缓存命中检测，二次处理同文件时跳过解析
- 实现 `process_folder` 完整流水线（扫描 → 处理 → 进度推送），支持取消
- 实现 `get_image_url`、`get_metadata`、`get_batch_metadata` Commands
- 保持 `RawExtractor` trait 抽象，为后续 CR2/ARW/RAF 格式预留扩展点
- Rust 核心模块单元测试覆盖率 ≥ 85%

**Non-Goals:**

- pHash 计算和相似度分组（Stage 3 范围）
- 前端 PixiJS 画布渲染（Stage 4 范围）
- 前端复杂进度对话框 UI（Stage 3 实现完整版，本阶段仅做基础进度展示）
- 多 RAW 格式实际支持（仅预留 trait，本阶段只实现 NEF）
- 并发参数调优和性能优化（Stage 6 范围）

## Decisions

### 1. 自行解析 TIFF IFD 链，而非使用现成 crate

**选择**: 手写 TIFF IFD 解析器（`nef_parser.rs`）

**原因**: `kamadak-exif` 专注于标准 Exif 标签，不暴露 SubImage3 IFD 中的 `JPEGInterchangeFormat`/`JPEGInterchangeFormatLength` 字段。Nikon NEF 的最大嵌入 JPEG 通常在 SubImage2 或 SubImage3 中，需要手动遍历 IFD 链定位。

**替代方案**: 使用 `rawloader` 或 `libopenraw` —— 前者不支持 JPEG 提取，后者有 C 依赖增加构建复杂度。

**权衡**: 增加约 300 行 IFD 解析代码，但获得完全的格式控制能力和零外部 C 依赖。

### 2. 缓存键使用 MD5(规范化绝对路径)

**选择**: `md5(canonical_absolute_path)` 作为缓存键

**原因**: 技术需求文档明确要求此方案。规范化路径消除符号链接和相对路径歧义，MD5 输出固定 32 字符十六进制字符串，适合作为文件名。

**替代方案**: 使用文件内容哈希 —— 更准确但对大 NEF 文件（30-60MB）计算开销过大。

### 3. 缩略图参数：200px 宽 + Lanczos3 + JPEG quality=85

**选择**: 严格遵循技术需求文档的参数规格

**原因**: 200px 宽度足够 pHash 计算（Stage 3 需要 9×8 矩阵），Lanczos3 在缩放质量和性能间取得平衡，quality=85 在文件大小和视觉质量间折中。

### 4. `RawExtractor` trait + `NefExtractor` 实现

**选择**: trait 抽象 + 具体实现分离

**原因**: 技术需求文档设计了 `RawExtractor` trait，后续 Stage 需要支持 CR2/ARW/RAF。trait 定义 `supported_extensions()`、`extract_jpeg()`、`extract_metadata()` 三个核心方法。

**本阶段只实现 `NefExtractor`**，trait 和 dispatch 机制同步搭建。

### 5. 异步 IO 使用 tokio::fs + Semaphore 并发控制

**选择**: `tokio::fs` 异步文件操作 + `Semaphore(8)` 限制并发数

**原因**: NEF 文件较大（30-60MB），IO 密集操作需要异步避免阻塞。8 路并发是技术需求文档推荐值，在磁盘 IO 带宽和 CPU 解码之间平衡。

**进度推送**: 每处理完一个文件通过 `window.emit("processing-progress", ...)` 推送进度事件。

### 6. 前端仅做最小化进度集成

**选择**: 在 `MainPage.tsx` 中接入 `processService` 事件监听，用简单的状态文本展示进度

**原因**: Stage 3 会实现完整的 `ProgressDialog` 组件和 `useProcessing` hook。本阶段只需验证 IPC 进度通道端到端可用。

## Risks / Trade-offs

- **[IFD 结构兼容性]** → 不同 Nikon 相机型号的 NEF IFD 结构可能有差异。缓解：以 Z50_2 和 Z5 为首要目标，解析器做防御性处理，遇到非预期结构时返回明确错误而非 panic。
- **[大文件内存峰值]** → 单张 NEF 30-60MB 全量读入内存。缓解：8 路并发下最坏情况 ~480MB，在可接受范围内。后续可优化为 mmap 或分段读取。
- **[kamadak-exif 标签覆盖度]** → 某些 Nikon 私有标签可能不被识别。缓解：所有 `ImageMetadata` 字段使用 `Option`，缺失标签优雅降级为 `None`。
- **[缓存目录权限]** → `app_cache_dir()` 在某些 Windows 配置下可能失败。缓解：启动时检测目录可写性，失败时报告明确错误。
- **[JPEG 提取失败率]** → 损坏的 NEF 文件或非标准结构可能导致 JPEG 魔数验证失败。缓解：单文件失败不中断批量处理，收集错误并在结果中报告。
