## Why

Stage 1 已搭建完整的 Tauri 双窗口骨架和数据模型，但 Rust 后端的核心处理模块（`core/`、`utils/`）和关键 Commands（`process_folder`、`get_image_url`、`get_metadata`）仍为 `todo!()` 空壳。用户选择文件夹后无法进行任何实质性的 NEF 文件处理。Stage 2 需要实现 NEF 解析核心和缓存系统，使应用能够：读取 NEF 文件 → 解析 TIFF IFD 链 → 提取嵌入 JPEG → 解析 Exif 元数据 → 生成缩略图 → 写入文件缓存，并通过已有的 IPC 通道将结果返回前端。

## What Changes

- **NEF/TIFF IFD 解析器**：实现 TIFF 头解析、IFD 链遍历、SubIFD 递归、嵌入 JPEG 定位提取、JPEG 魔数验证，以及 `RawExtractor` trait 为后续多格式扩展预留
- **Exif 元数据解析**：集成 `kamadak-exif`，将 Exif 标签映射到已定义的 `ImageMetadata` 结构，包括时间解析、GPS 坐标转换、缺失标签优雅降级
- **RAW 处理器**：协调 NEF 解析与 Exif 提取，将嵌入 JPEG 解码并保存为 medium 图片，生成 200px 宽 Lanczos3 缩略图
- **文件缓存系统**：MD5 路径哈希、缓存目录管理（`{app_cache_dir}/bulbul/medium/` + `thumbnail/`）、缓存命中检测、缩略图写入
- **路径工具函数**：规范化路径、MD5 哈希计算、缓存目录路径构建
- **Commands 实现**：将 `process_folder`（扫描→处理→进度推送）、`cancel_processing`、`get_image_url`、`get_metadata`、`get_batch_metadata` 从 `todo!()` 实现为可用状态
- **前端进度联调**：在 `MainPage` 中接入已有的 `processService` 事件监听，实现基础的处理触发与进度展示

## Capabilities

### New Capabilities
- `nef-parser`: NEF/TIFF 文件格式解析，IFD 链遍历，嵌入 JPEG 定位与提取，RawExtractor trait 抽象
- `exif-metadata`: Exif 元数据解析，标签到 ImageMetadata 的映射，时间/GPS/曝光参数提取
- `raw-processor`: RAW 文件处理协调器，JPEG 解码保存，缩略图生成（200px Lanczos3）
- `file-cache`: 文件缓存系统，MD5 路径哈希，缓存目录管理，命中检测，异步读写
- `path-utils`: 路径规范化、MD5 哈希、缓存目录路径工具

### Modified Capabilities
- `file-commands`: 扩展 `scan_raw_files` 的结果集成到处理流水线，`process_folder` 从空壳变为完整实现
- `session-state`: 处理完成后填充 `filename_hash_map`、`hash_filename_map`、`hash_path_map`、`metadata_cache` 等映射

## Impact

- **Rust 代码**：~1800 行新增，涉及 `core/nef_parser.rs`、`core/metadata.rs`、`core/raw_processor.rs`、`utils/cache.rs`、`utils/paths.rs`、`commands/process_commands.rs`、`commands/image_commands.rs`
- **前端代码**：~200 行修改，主要在 `MainPage.tsx` 中集成处理触发和基础进度展示
- **依赖激活**：`image 0.25`、`kamadak-exif 0.5`、`md5 0.7`、`chrono 0.4`、`lru 0.12`（已在 Cargo.toml 中声明但未使用）
- **文件系统**：运行时在 `{app_cache_dir}/bulbul/` 下创建 `medium/` 和 `thumbnail/` 缓存目录
- **测试**：新增 Rust 单元测试覆盖 TIFF/IFD 解析、JPEG 提取、Exif 解析、缓存系统、缩略图生成，目标覆盖率 ≥ 85%
