## 1. 重构 trait — RawExtractor → ImageExtractor

- [x] 1.1 在 `raw_parser.rs` 中将 `RawExtractor` trait 重命名为 `ImageExtractor`，将 `extract_jpeg()` 方法重命名为 `get_image_data()`，更新方法文档注释
- [x] 1.2 迁移所有 9 个 RAW Extractor 实现（Nef/Cr2/Arw/Dng/Orf/Rw2/Pef/Raf/Cr3）的 `impl RawExtractor` → `impl ImageExtractor`，`extract_jpeg()` → `get_image_data()`
- [x] 1.3 更新 `get_extractor()` 返回类型为 `Box<dyn ImageExtractor>`，保持原有 9 个 match arm 不变
- [x] 1.4 更新 `raw_processor.rs` 中 `read_exif_from_header()` 参数类型 `&dyn RawExtractor` → `&dyn ImageExtractor`
- [x] 1.5 运行 `cargo check` 确认编译通过

## 2. 新增非 RAW 格式 Extractor

- [x] 2.1 实现 `JpegExtractor`：`get_image_data()` 返回 `data.to_vec()`，`extract_metadata()` 调用 `parse_exif()`，`exif_header_size()` 返回 0
- [x] 2.2 实现 `PngExtractor`：`get_image_data()` 返回 `data.to_vec()`，`extract_metadata()` 返回 `ImageMetadata::default()`，`exif_header_size()` 返回 0
- [x] 2.3 实现 `TiffExtractor`：`get_image_data()` 返回 `data.to_vec()`，`extract_metadata()` 调用 `parse_exif()`，`exif_header_size()` 返回 0
- [x] 2.4 实现 `WebpExtractor`：`get_image_data()` 返回 `data.to_vec()`，`extract_metadata()` 尝试 `parse_exif()` 失败返回 `ImageMetadata::default()`，`exif_header_size()` 返回 0
- [x] 2.5 在 `get_extractor()` 中添加 jpg/jpeg/png/tiff/tif/webp 的 match arm
- [x] 2.6 运行 `cargo test` 确认所有现有测试通过

## 3. 扩展扫描过滤

- [x] 3.1 在 `raw_parser.rs` 中新增 `SUPPORTED_IMAGE_EXTENSIONS` 和 `ALL_SUPPORTED_EXTENSIONS` 常量
- [x] 3.2 新增 `is_supported_extension()` 函数
- [x] 3.3 更新 `scan_raw_files_internal()` → `scan_image_files_internal()`，使用 `is_supported_extension()`
- [x] 3.4 更新 `process_commands.rs` 中对扫描函数的调用和日志文案（"NEF 文件" → "图片文件"）
- [x] 3.5 运行 `cargo check` 确认编译通过

## 4. 更新 raw_processor.rs

- [x] 4.1 重命名 `process_single_raw()` → `process_single_image()`，添加 `pub use process_single_image as process_single_raw;` 别名
- [x] 4.2 将内部 `extract_jpeg()` 调用改为 `get_image_data()`
- [x] 4.3 更新 `generate_thumbnail()` 和 `generate_medium()` 错误消息中 "JPEG 解码失败" → "图像解码失败"
- [x] 4.4 更新模块文档和函数文档注释，移除"RAW"措辞
- [x] 4.5 运行 `cargo test` 确认测试通过

## 5. 更新 file_commands.rs 和错误类型

- [x] 5.1 重命名 `FolderInfo.raw_count` → `FolderInfo.image_count`
- [x] 5.2 重命名 `scan_raw_files` 命令 → `scan_image_files`，更新内部使用 `is_supported_extension()`
- [x] 5.3 更新 `get_folder_info()` 使用 `is_supported_extension()`
- [x] 5.4 更新 `process_commands.rs` 中 `process_folder` 对扫描函数的调用
- [x] 5.5 在 `error.rs` 中重命名 `RawParseError` → `ImageParseError`，添加 `pub use ImageParseError as RawParseError;` 别名
- [x] 5.6 更新 `raw_parser.rs` 中所有 `RawParseError` → `ImageParseError` 引用
- [x] 5.7 运行 `cargo test` 确认所有测试通过

## 6. 更新前端

- [x] 6.1 更新 `src/types/index.ts`：`rawCount` → `imageCount`，注释 "RAW 图像元数据" → "图像元数据"
- [x] 6.2 更新 `src/services/fileService.ts`：`scanRawFiles()` → `scanImageFiles()`，Tauri 命令名 `'scan_raw_files'` → `'scan_image_files'`
- [x] 6.3 更新 `src/windows/MainPage.tsx`：行内类型 `rawCount` → `imageCount`，UI 文案更新
- [x] 6.4 更新 `src/windows/WelcomePage.tsx`：aria-label 更新
- [x] 6.5 更新测试文件：`fileService.test.ts` 和 `useAppStore.test.ts` 中 `rawCount` → `imageCount`
- [x] 6.6 运行 `npx tsc --noEmit` 和 `npx vitest run` 确认编译和测试通过

## 7. 集成验证

- [x] 7.1 运行完整后端测试套件 `cd src-tauri && cargo test`
- [x] 7.2 运行完整前端测试套件 `npx vitest run`
- [x] 7.3 运行 `npm run build` 确认生产构建通过
