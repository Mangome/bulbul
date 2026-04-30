## Why

Bulbul 目前仅支持 RAW 格式文件（NEF、CR2、ARW 等 9 种），但用户经常在 RAW 拍摄目录中混放 JPEG/PNG 等非 RAW 图片，或希望对纯 JPEG 目录进行相似度分组。扩展格式支持可让应用覆盖更多使用场景，无需用户事先分离文件类型。

## What Changes

- 重构 `RawExtractor` trait 为 `ImageExtractor`，方法 `extract_jpeg()` → `get_image_data()`，语义更通用
- 新增 4 个图片格式提取器：`JpegExtractor`、`PngExtractor`、`TiffExtractor`、`WebpExtractor`
- 扩展文件扫描过滤，新增 `jpg`/`jpeg`/`png`/`tiff`/`tif`/`webp` 扩展名支持
- 重命名后端 IPC 接口：`scan_raw_files` → `scan_image_files`，`FolderInfo.raw_count` → `image_count` (**BREAKING**)
- 重命名 `process_single_raw` → `process_single_image`，`RawParseError` → `ImageParseError`
- 更新前端类型、服务和 UI 文案中的 "RAW" 引用

## Capabilities

### New Capabilities
- `non-raw-extractors`: JPEG/PNG/TIFF/WebP 格式的 ImageExtractor 实现，包括图像数据获取和 EXIF 提取策略

### Modified Capabilities
- `nef-parser`: trait 从 RawExtractor 重构为 ImageExtractor，方法签名变更
- `raw-processor`: 函数重命名 + 调用路径适配非 RAW 格式
- `file-commands`: 扫描过滤扩展 + 结构体字段重命名 + 命令重命名
- `processing-pipeline`: 扫描阶段支持新格式 + 日志文案更新
- `frontend-types`: `rawCount` → `imageCount` 字段重命名
- `ipc-services`: 前端服务函数重命名 + Tauri 命令名更新

## Impact

- **后端 API**: `scan_raw_files` 命令重命名为 `scan_image_files`，`FolderInfo.raw_count` 重命名为 `image_count`（**BREAKING** — 前后端需同步更新）
- **后端模块**: `raw_parser.rs`（trait 重构 + 新 Extractor）、`raw_processor.rs`（函数重命名 + 调用适配）、`file_commands.rs`（命令重命名 + 字段重命名）、`process_commands.rs`（扫描逻辑更新）、`error.rs`（错误类型重命名）
- **前端**: `types/index.ts`、`fileService.ts`、`MainPage.tsx`、`WelcomePage.tsx`、测试文件
- **缓存**: 完全兼容，新旧版本缓存文件格式不变
- **依赖**: 无新增 crate 依赖（`image` crate 0.25 已支持所有目标格式）
