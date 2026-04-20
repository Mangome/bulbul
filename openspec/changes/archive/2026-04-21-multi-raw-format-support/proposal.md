## Why

当前应用仅支持 Nikon NEF 格式的 RAW 文件处理，硬编码了 `.nef` 扩展名匹配和 NEF 专属错误消息。市面上 Canon、Sony、Fuji、Olympus、Panasonic、Pentax 等主流厂商的 RAW 格式用户无法使用本应用，限制了受众范围。绝大多数主流 RAW 格式基于 TIFF/EP 结构，现有的 NEF 解析器（TIFF IFD 遍历 + 嵌入 JPEG 提取）可直接复用，扩充成本较低。

## What Changes

- **重命名** `nef_parser` 模块为 `raw_parser`，反映通用 RAW 格式定位
- **重命名** `AppError::NefParseError` 为 `AppError::RawParseError`，更新所有错误消息中的 "NEF" 为 "RAW"
- **新增** `SUPPORTED_RAW_EXTENSIONS` 统一常量，包含 nef/cr2/cr3/arw/dng/raf/orf/rw2/pef
- **新增** TIFF/EP 格式 Extractor：`Cr2Extractor`、`ArwExtractor`、`DngExtractor`、`OrfExtractor`、`Rw2Extractor`、`PefExtractor`（均复用现有 `extract_largest_jpeg()`）
- **新增** Fuji RAF 格式 `RafExtractor`（解析文件头偏移表提取嵌入 JPEG）
- **新增** Canon CR3 格式 `Cr3Extractor`（ISOBMFF 容器解析，引入 `mp4parse` crate）
- **统一** 三处分散的 `.nef` 扩展名硬编码为调用 `SUPPORTED_RAW_EXTENSIONS` 的统一函数
- **修复** `export_commands.rs` 中 fallback 文件名 `.nef` 硬编码，改为保留原始扩展名
- **更新** 前端 UI 文案 "NEF 文件" → "RAW 文件"

## Capabilities

### New Capabilities
- `tiff-ep-extractors`: 通用 TIFF/EP RAW 格式（CR2/ARW/DNG/ORF/RW2/PEF）的 Extractor 实现，复用现有 TIFF IFD 遍历逻辑提取嵌入 JPEG
- `raf-extractor`: Fuji RAF 格式解析器，解析文件头偏移表提取嵌入 JPEG
- `cr3-extractor`: Canon CR3 格式解析器，基于 ISOBMFF 容器解析提取嵌入 JPEG

### Modified Capabilities
- `nef-parser`: 重命名为通用 RAW 解析器，`NefParseError` → `RawParseError`，`get_extractor()` 扩展支持新格式，新增 `SUPPORTED_RAW_EXTENSIONS` 常量和 `is_raw_extension()` 函数
- `raw-processor`: 移除对 `nef_parser` 模块名的直接依赖，通过 `raw_parser` 调用；`extract_largest_jpeg` 改为通过 Extractor trait 调用
- `file-commands`: `get_folder_info` 和 `scan_raw_files` 中的 `.nef` 硬编码替换为 `is_raw_extension()` 调用
- `processing-pipeline`: `scan_nef_files` 重命名为 `scan_raw_files`，使用 `SUPPORTED_RAW_EXTENSIONS` 过滤
- `exif-metadata`: Exif 头部 64KB 读取策略需适配非 TIFF/EP 格式（CR3/RAF）

## Impact

- **Rust 核心代码**: `nef_parser.rs`（重命名+重构）、`raw_processor.rs`、`process_commands.rs`、`file_commands.rs`、`export_commands.rs`、`error.rs`、`mod.rs`
- **新增依赖**: `mp4parse` crate（CR3 ISOBMFF 解析）
- **前端**: `MainPage.tsx` 一处文案修改
- **测试**: 所有 `NefParseError` 引用更新为 `RawParseError`，新增多格式 Extractor 测试
- **缓存/导出**: 缓存路径基于 hash 不受影响；导出 fallback 文件名需从原始路径取扩展名
