## 1. 基础设施重构（Phase 1 前置）

- [x] 1.1 重命名 `nef_parser.rs` → `raw_parser.rs`，更新 `mod.rs` 中的 `pub mod` 声明
- [x] 1.2 重命名 `AppError::NefParseError` → `AppError::RawParseError`，更新 `error.rs` 中的错误消息和 `user_message()`（"NEF" → "RAW"），全局替换所有引用
- [x] 1.3 在 `raw_parser.rs` 中新增 `SUPPORTED_RAW_EXTENSIONS: &[&str]` 常量和 `is_raw_extension(extension: &str) -> bool` 函数
- [x] 1.4 在 `RawExtractor` trait 中新增 `exif_header_size(&self) -> usize` 方法，为 `NefExtractor` 实现返回 65536
- [x] 1.5 运行 `cargo check` 和 `npx vitest run` 确认所有现有测试通过

## 2. TIFF/EP 格式 Extractor 实现（Phase 1）

- [x] 2.1 实现 `Cr2Extractor`，`supported_extensions()` 返回 `["cr2"]`，`extract_jpeg()` 调用 `extract_largest_jpeg()`
- [x] 2.2 实现 `ArwExtractor`，`supported_extensions()` 返回 `["arw"]`，`extract_jpeg()` 调用 `extract_largest_jpeg()`
- [x] 2.3 实现 `DngExtractor`，`supported_extensions()` 返回 `["dng"]`，`extract_jpeg()` 调用 `extract_largest_jpeg()`
- [x] 2.4 实现 `OrfExtractor`，`supported_extensions()` 返回 `["orf"]`，`extract_jpeg()` 调用 `extract_largest_jpeg()`
- [x] 2.5 实现 `Rw2Extractor`，`supported_extensions()` 返回 `["rw2"]`，`extract_jpeg()` 调用 `extract_largest_jpeg()`
- [x] 2.6 实现 `PefExtractor`，`supported_extensions()` 返回 `["pef"]`，`extract_jpeg()` 调用 `extract_largest_jpeg()`
- [x] 2.7 扩展 `get_extractor()` match 语句，注册 cr2/arw/dng/orf/rw2/pef 六个新分支
- [x] 2.8 为每个新 Extractor 编写单元测试（验证 `supported_extensions()` 和 `get_extractor()` 分发）

## 3. 统一扫描逻辑（Phase 1）

- [x] 3.1 将 `process_commands.rs` 中的 `scan_nef_files()` 重命名为 `scan_raw_files_internal()`，替换 `.nef` 硬编码为 `is_raw_extension()` 调用
- [x] 3.2 更新 `file_commands.rs` 中 `get_folder_info()` 的扩展名检查，替换为 `is_raw_extension()` 调用
- [x] 3.3 更新 `file_commands.rs` 中 `scan_raw_files()` 的扩展名检查，替换为 `is_raw_extension()` 调用
- [x] 3.4 修复 `export_commands.rs:109` 的 fallback 文件名，从原始文件路径取扩展名替代 `.nef` 硬编码

## 4. raw_processor 适配（Phase 1）

- [x] 4.1 更新 `raw_processor.rs` 中 `use crate::core::nef_parser` → `use crate::core::raw_parser`
- [x] 4.2 更新 `process_single_raw()` 中的 JPEG 提取逻辑：通过 `get_extractor()` 获取 Extractor 后调用 `extractor.extract_jpeg(&data)` 替代直接调用 `nef_parser::extract_largest_jpeg()`
- [x] 4.3 修改 `read_exif_from_header()`：接受 `exif_header_size` 参数，当值为 0 时跳过头部快速读取直接返回错误触发全量读取
- [x] 4.4 更新缓存命中路径：先调用 `get_extractor()` 获取 `exif_header_size()`，传入 `read_exif_from_header()`

## 5. 前端文案更新（Phase 1）

- [x] 5.1 更新 `MainPage.tsx:338` 的 `'该目录下未找到 NEF 文件'` → `'该目录下未找到 RAW 文件'`

## 6. Phase 1 验证

- [x] 6.1 运行 `cd src-tauri && cargo test` 确认所有 Rust 测试通过
- [x] 6.2 运行 `npx vitest run` 确认所有前端测试通过
- [x] 6.3 运行 `npx tsc --noEmit` 确认 TypeScript 类型检查通过
- [ ] 6.4 用包含 NEF 文件的目录做端到端验证，确认现有功能不受影响

## 7. Fuji RAF 解析器实现（Phase 2）

- [x] 7.1 在 `raw_parser.rs` 中实现 RAF 文件头解析函数 `parse_raf_header()`：验证魔数 `FUJIFILMCCD-RAW`，读取 JPEG 偏移量和长度（big-endian u32）
- [x] 7.2 实现 `extract_raf_jpeg()` 函数：根据偏移量和长度提取 JPEG 数据，验证 SOI 魔数
- [x] 7.3 实现 `RafExtractor` struct，实现 `RawExtractor` trait，`exif_header_size()` 返回 65536
- [x] 7.4 在 `get_extractor()` 中注册 `"raf"` 分支
- [x] 7.5 编写 RAF 解析器单元测试（构造测试数据验证魔数验证、JPEG 提取、越界处理）

## 8. Canon CR3 解析器实现（Phase 3）

- [x] 8.1 ~~在 `src-tauri/Cargo.toml` 中添加 `mp4parse` 依赖~~ → 改用手写 ISOBMFF box 遍历器，无需外部依赖
- [x] 8.2 在 `raw_parser.rs` 中实现 CR3 ISOBMFF 容器解析函数：手写 box 遍历器，定位 PRVW/THMB UUID box 中的 JPEG 预览
- [x] 8.3 实现 `Cr3Extractor` struct，实现 `RawExtractor` trait，`exif_header_size()` 返回 0
- [x] 8.4 在 `get_extractor()` 中注册 `"cr3"` 分支
- [x] 8.5 编写 CR3 解析器单元测试（mock ISOBMFF 数据验证解析逻辑）
- [x] 8.6 确保 `raw_processor.rs` 中 CR3 缓存命中路径正确处理 `exif_header_size() == 0`（全量读取）

## 9. Phase 2-3 端到端验证

- [x] 9.1 运行 `cd src-tauri && cargo test` 确认所有 Rust 测试通过（含 RAF 和 CR3 测试）
- [ ] 9.2 用包含混合 RAW 格式文件的目录做端到端验证（如同时包含 .nef 和 .cr2 文件）
