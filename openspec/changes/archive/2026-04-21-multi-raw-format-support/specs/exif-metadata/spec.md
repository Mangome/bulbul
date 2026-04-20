## MODIFIED Requirements

### Requirement: Exif 头部快速读取
系统 SHALL 在缓存命中时尝试读取文件头部解析 Exif 以避免全量读取。头部读取大小 SHALL 由对应格式的 `RawExtractor::exif_header_size()` 决定。当 `exif_header_size()` 返回 0 时，SHALL 直接全量读取文件。头部读取失败时 SHALL 自动回退全量读取。

#### Scenario: TIFF/EP 格式头部快速读取
- **WHEN** 缓存命中且文件扩展名对应的 Extractor 的 `exif_header_size()` 返回 65536
- **THEN** SHALL 仅读取文件前 64KB 解析 Exif

#### Scenario: CR3 格式全量读取
- **WHEN** 缓存命中且文件扩展名为 `.cr3`（`exif_header_size()` 返回 0）
- **THEN** SHALL 全量读取文件解析 Exif，不尝试头部快速读取

#### Scenario: 头部读取失败回退
- **WHEN** 缓存命中但头部快速读取后 Exif 解析失败（字段偏移超出头部范围）
- **THEN** SHALL 自动回退全量读取文件并重新解析 Exif
