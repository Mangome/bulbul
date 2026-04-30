## Context

Bulbul 是一个 Tauri 2 桌面应用，前端 React 18 + PixiJS 画布，后端 Rust 处理 RAW 图片文件。当前仅支持 9 种 RAW 格式（NEF/CR2/CR3/ARW/DNG/RAF/ORF/RW2/PEF），通过 `RawExtractor` trait 从容器中提取嵌入 JPEG 预览进行后续处理。

管线中段及之后完全格式无关：pHash 从缩略图 JPEG 计算，分组基于 pHash 汉明距离，合焦评分基于 medium JPEG——这些都已经是生成的 JPEG 缓存文件。扩展格式只需改管线前端的"输入解析"环节。

`image` crate 0.25 已支持 JPEG/PNG/TIFF/WebP 解码，`kamadak-exif` 支持 JPEG APP1 段和 TIFF IFD 的 EXIF 解析。

## Goals / Non-Goals

**Goals:**
- 支持 JPEG、PNG、TIFF、WebP 作为输入格式
- 重构 `RawExtractor` trait 为语义更通用的 `ImageExtractor`
- 非 RAW 格式的文件直接作为图像数据传入管线，无需"提取嵌入 JPEG"
- 保持缓存兼容性（新旧版本缓存文件格式不变）

**Non-Goals:**
- 不实现 PNG eXIf chunk 解析（返回空 metadata）
- 不调整合焦评分阈值
- 不修改管线中段及之后的逻辑（pHash、分组、评分）
- 不支持递归目录扫描

## Decisions

### D1: `get_image_data()` 返回原始文件字节而非预转换 JPEG

**选择**：非 RAW 格式的 `get_image_data()` 直接返回原始文件字节（`data.to_vec()`），由 `generate_medium()`/`generate_thumbnail()` 中的 `image::load_from_memory()` 统一解码。

**替代方案**：在 `get_image_data()` 内先用 `image` crate 解码再重编码为 JPEG。这会导致不必要的编解码开销（PNG→解码→JPEG编码→后续又解码→缩放→JPEG编码）。

**理由**：`image::load_from_memory()` 支持 JPEG/PNG/TIFF/WebP，无需提前转换。保留原始字节让 `generate_medium/thumbnail` 一次解码即可，减少有损压缩次数。

### D2: JPEG EXIF 解析复用 `kamadak-exif`，非 RAW 格式 `exif_header_size` 返回 0

**选择**：JPEG 的 `extract_metadata()` 直接将文件字节传给 `kamadak-exif` 的 `parse_exif()`，`exif_header_size()` 返回 0（全量读取）。

**理由**：kamadak-exif 的 `Reader::read_from_container()` 可从 JPEG APP1 段解析 EXIF，无需特殊处理。JPEG 的 EXIF 不像 TIFF/EP 那样集中在文件头部 64KB，无法使用头部快速读取优化。

### D3: WebP EXIF 解析采用尽力而为策略

**选择**：`WebpExtractor::extract_metadata()` 尝试 `parse_exif()`，失败则返回 `ImageMetadata::default()`。

**理由**：WebP 的 EXIF 支持不完善（kamadak-exif 不保证能解析所有 WebP EXIF），返回空 metadata 比报错更友好。

### D4: 保留 `SUPPORTED_RAW_EXTENSIONS` 常量，新增 `SUPPORTED_IMAGE_EXTENSIONS` 和 `ALL_SUPPORTED_EXTENSIONS`

**选择**：不删除旧常量，新增两组常量分层管理。

**理由**：内部可能有逻辑需要区分 RAW 和非 RAW 文件（如日志统计），保留分类常量有利于未来需求。`is_raw_extension()` 保留不动，新增 `is_supported_extension()`。

### D5: 前后端同步重命名 `raw_count` → `image_count`、`scan_raw_files` → `scan_image_files`

**选择**：作为 BREAKING 变更一次性完成，不保留旧名称兼容。

**理由**：这是桌面应用，前后端同版本发布，无需向后兼容。保留旧名会增加维护负担。

### D6: 错误类型 `RawParseError` → `ImageParseError`，保留类型别名

**选择**：重命名枚举变体，添加 `pub use ImageParseError as RawParseError;` 类型别名。

**理由**：减少改动面，外部引用暂不强制更新。`NoEmbeddedJpeg` 保留不变（仅 RAW 路径触发）。

## Risks / Trade-offs

- **[JPEG 重编码质量损失]** JPEG 文件经 `image::load_from_memory()` 解码后再重新编码为 JPEG（缩放时），会有额外的有损压缩。→ 可接受：这是缩略图/medium 场景，原始 JPEG 文件仍可导出。对于不放大情况（`orig_width <= MEDIUM_WIDTH`），仍然重新编码以保证格式一致性。
- **[PNG 文件全量读取内存开销]** PNG 文件通常比 RAW 小很多（几百 KB vs 几十 MB），全量读取无性能问题。→ 无需额外优化。
- **[TIFF 文件可能同时被 RAW extractor 和 TiffExtractor 匹配]** 扩展名 `.tif`/`.tiff` 在 `SUPPORTED_RAW_EXTENSIONS` 中不存在，不会冲突。→ 无风险。
- **[缓存指纹兼容性]** `compute_path_hash` 基于文件路径计算，与格式无关。新格式的缓存文件路径格式与现有相同。→ 完全兼容。
