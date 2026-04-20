## Purpose

为 Canon CR3 格式 RAW 文件提供 ISOBMFF 容器解析和 RawExtractor trait 实现。CR3 使用 ISO Base Media File Format 容器（非 TIFF/EP），需要使用 `mp4parse` crate 解析 box 结构以提取嵌入 JPEG 预览图。

## Requirements

### Requirement: CR3 ISOBMFF 容器解析
系统 SHALL 使用 `mp4parse` crate 解析 Canon CR3 文件的 ISO Base Media File Format (ISOBMFF) 容器结构，定位 `CRAW` box 中的 JPEG 预览图像数据。

#### Scenario: 有效 CR3 文件解析
- **WHEN** 解析一个有效的 Canon CR3 文件
- **THEN** SHALL 使用 `mp4parse` 遍历 ISOBMFF box 结构，定位 `CRAW` box，从中提取 JPEG 预览数据，返回 `Vec<u8>`

#### Scenario: CR3 文件无 CRAW box
- **WHEN** 解析一个不包含 `CRAW` box 的 CR3 文件
- **THEN** SHALL 返回 `AppError::NoEmbeddedJpeg` 错误

#### Scenario: CR3 文件格式无效
- **WHEN** 传入一个不是有效 ISOBMFF 容器的文件
- **THEN** SHALL 返回 `AppError::RawParseError` 错误

### Requirement: Cr3Extractor 实现
系统 SHALL 实现 `Cr3Extractor` 结构体，实现 `RawExtractor` trait。`supported_extensions()` SHALL 返回 `["cr3"]`，`exif_header_size()` SHALL 返回 0（CR3 的 Exif 存储在 ISOBMFF box 中，无法通过固定偏移读取）。

#### Scenario: Cr3Extractor trait 方法
- **WHEN** 创建 `Cr3Extractor` 实例
- **THEN** `supported_extensions()` SHALL 返回 `["cr3"]`，`extract_jpeg()` SHALL 调用 CR3 专用 ISOBMFF 解析逻辑，`extract_metadata()` SHALL 调用通用 Exif 解析器（需全量数据）

#### Scenario: Cr3 Exif 头部大小
- **WHEN** 调用 `Cr3Extractor` 的 `exif_header_size()` 方法
- **THEN** SHALL 返回 0，表示缓存命中时不能使用头部快速读取，需要全量读取文件以解析 ISOBMFF 容器中的 Exif 数据
