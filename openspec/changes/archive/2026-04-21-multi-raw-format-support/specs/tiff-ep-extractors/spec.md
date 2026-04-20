## ADDED Requirements

### Requirement: TIFF/EP 格式 Extractor 实现
系统 SHALL 为以下 TIFF/EP 格式实现 `RawExtractor` trait：`Cr2Extractor`（Canon CR2）、`ArwExtractor`（Sony ARW）、`DngExtractor`（Adobe DNG）、`OrfExtractor`（Olympus ORF）、`Rw2Extractor`（Panasonic RW2）、`PefExtractor`（Pentax PEF）。每个 Extractor 的 `extract_jpeg()` 方法 SHALL 调用通用的 `extract_largest_jpeg()` 函数，`extract_metadata()` 方法 SHALL 调用通用的 `parse_exif()` 函数。

#### Scenario: Cr2Extractor 提取嵌入 JPEG
- **WHEN** 使用 `Cr2Extractor` 处理一个有效的 Canon CR2 文件
- **THEN** `extract_jpeg()` SHALL 返回 TIFF IFD 中最大的嵌入 JPEG 数据，`supported_extensions()` SHALL 返回 `["cr2"]`

#### Scenario: ArwExtractor 提取嵌入 JPEG
- **WHEN** 使用 `ArwExtractor` 处理一个有效的 Sony ARW 文件
- **THEN** `extract_jpeg()` SHALL 返回 TIFF IFD 中最大的嵌入 JPEG 数据，`supported_extensions()` SHALL 返回 `["arw"]`

#### Scenario: DngExtractor 提取嵌入 JPEG
- **WHEN** 使用 `DngExtractor` 处理一个有效的 Adobe DNG 文件
- **THEN** `extract_jpeg()` SHALL 返回 TIFF IFD 中最大的嵌入 JPEG 数据，`supported_extensions()` SHALL 返回 `["dng"]`

#### Scenario: OrfExtractor 提取嵌入 JPEG
- **WHEN** 使用 `OrfExtractor` 处理一个有效的 Olympus ORF 文件
- **THEN** `extract_jpeg()` SHALL 返回 TIFF IFD 中最大的嵌入 JPEG 数据，`supported_extensions()` SHALL 返回 `["orf"]`

#### Scenario: Rw2Extractor 提取嵌入 JPEG
- **WHEN** 使用 `Rw2Extractor` 处理一个有效的 Panasonic RW2 文件
- **THEN** `extract_jpeg()` SHALL 返回 TIFF IFD 中最大的嵌入 JPEG 数据，`supported_extensions()` SHALL 返回 `["rw2"]`

#### Scenario: PefExtractor 提取嵌入 JPEG
- **WHEN** 使用 `PefExtractor` 处理一个有效的 Pentax PEF 文件
- **THEN** `extract_jpeg()` SHALL 返回 TIFF IFD 中最大的嵌入 JPEG 数据，`supported_extensions()` SHALL 返回 `["pef"]`

#### Scenario: TIFF/EP 格式 Exif 头部大小
- **WHEN** 调用任意 TIFF/EP Extractor 的 `exif_header_size()` 方法
- **THEN** SHALL 返回 65536（64KB），因为 TIFF/EP 格式的 Exif 数据存储在文件头部的 IFD 中
