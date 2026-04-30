## ADDED Requirements

### Requirement: JpegExtractor 实现
系统 SHALL 提供 `JpegExtractor` 结构体，实现 `ImageExtractor` trait。`supported_extensions()` SHALL 返回 `["jpg", "jpeg"]`。`get_image_data()` SHALL 直接返回原始文件字节的拷贝（`data.to_vec()`）。`extract_metadata()` SHALL 使用 `kamadak-exif` 从 JPEG APP1 段解析 EXIF。`exif_header_size()` SHALL 返回 0（需全量读取）。

#### Scenario: JPEG 文件图像数据获取
- **WHEN** 对 JPEG 文件字节调用 `JpegExtractor::get_image_data()`
- **THEN** SHALL 返回与输入相同的字节（原始文件数据），不做任何转换

#### Scenario: JPEG 文件 EXIF 解析
- **WHEN** 对包含 APP1 EXIF 段的 JPEG 文件字节调用 `JpegExtractor::extract_metadata()`
- **THEN** SHALL 通过 `parse_exif()` 从 APP1 段提取完整的 ImageMetadata

#### Scenario: JPEG 文件无 EXIF
- **WHEN** 对不包含 EXIF 段的 JPEG 文件调用 `JpegExtractor::extract_metadata()`
- **THEN** SHALL 返回 `AppError::ExifError` 错误

#### Scenario: JPEG 缓存命中全量读取
- **WHEN** JPEG 文件缓存命中，调用 `JpegExtractor::exif_header_size()`
- **THEN** SHALL 返回 0，指示缓存命中时也需全量读取以解析 EXIF

### Requirement: PngExtractor 实现
系统 SHALL 提供 `PngExtractor` 结构体，实现 `ImageExtractor` trait。`supported_extensions()` SHALL 返回 `["png"]`。`get_image_data()` SHALL 直接返回原始文件字节的拷贝。`extract_metadata()` SHALL 返回 `ImageMetadata::default()`（空元数据，不解析 eXIf chunk）。`exif_header_size()` SHALL 返回 0。

#### Scenario: PNG 文件图像数据获取
- **WHEN** 对 PNG 文件字节调用 `PngExtractor::get_image_data()`
- **THEN** SHALL 返回原始 PNG 文件字节，由 `image::load_from_memory()` 解码

#### Scenario: PNG 文件元数据返回空
- **WHEN** 对任意 PNG 文件字节调用 `PngExtractor::extract_metadata()`
- **THEN** SHALL 返回 `ImageMetadata::default()`，所有字段为 None

### Requirement: TiffExtractor 实现
系统 SHALL 提供 `TiffExtractor` 结构体，实现 `ImageExtractor` trait。`supported_extensions()` SHALL 返回 `["tiff", "tif"]`。`get_image_data()` SHALL 直接返回原始文件字节的拷贝。`extract_metadata()` SHALL 使用 `kamadak-exif` 从 TIFF IFD 解析 EXIF。`exif_header_size()` SHALL 返回 0。

#### Scenario: TIFF 文件图像数据获取
- **WHEN** 对 TIFF 文件字节调用 `TiffExtractor::get_image_data()`
- **THEN** SHALL 返回原始 TIFF 文件字节

#### Scenario: TIFF 文件 EXIF 解析
- **WHEN** 对包含 IFD EXIF 数据的 TIFF 文件调用 `TiffExtractor::extract_metadata()`
- **THEN** SHALL 通过 `parse_exif()` 从 IFD 结构提取 ImageMetadata

### Requirement: WebpExtractor 实现
系统 SHALL 提供 `WebpExtractor` 结构体，实现 `ImageExtractor` trait。`supported_extensions()` SHALL 返回 `["webp"]`。`get_image_data()` SHALL 直接返回原始文件字节的拷贝。`extract_metadata()` SHALL 尝试 `parse_exif()`，解析失败时返回 `ImageMetadata::default()`。`exif_header_size()` SHALL 返回 0。

#### Scenario: WebP 文件图像数据获取
- **WHEN** 对 WebP 文件字节调用 `WebpExtractor::get_image_data()`
- **THEN** SHALL 返回原始 WebP 文件字节

#### Scenario: WebP 文件 EXIF 解析成功
- **WHEN** 对包含有效 EXIF 数据的 WebP 文件调用 `WebpExtractor::extract_metadata()`
- **THEN** SHALL 返回解析到的 ImageMetadata

#### Scenario: WebP 文件 EXIF 解析失败降级
- **WHEN** 对不包含 EXIF 数据的 WebP 文件调用 `WebpExtractor::extract_metadata()`
- **THEN** SHALL 返回 `ImageMetadata::default()`，不报错
