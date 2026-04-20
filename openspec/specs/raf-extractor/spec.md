## Purpose

为 Fuji RAF 格式 RAW 文件提供文件头解析、嵌入 JPEG 提取和 RawExtractor trait 实现。RAF 格式使用独特的固定头部结构（非 TIFF/EP），需要专用解析逻辑。

## Requirements

### Requirement: Fuji RAF 文件头解析
系统 SHALL 解析 Fuji RAF 文件头（前 148 字节固定结构），提取文件魔数（`FUJIFILMCCD-RAW`）、JPEG 偏移量和 JPEG 长度字段。

#### Scenario: 有效 RAF 文件头解析
- **WHEN** 解析一个有效的 Fuji RAF 文件
- **THEN** SHALL 读取文件头前 148 字节，验证魔数为 `FUJIFILMCCD-RAW`（前 16 字节），从偏移 84 读取 JPEG 偏移量（big-endian u32），从偏移 88 读取 JPEG 长度（big-endian u32）

#### Scenario: 无效 RAF 魔数
- **WHEN** 解析一个文件头前 16 字节不以 `FUJIFILMCCD-RAW` 开头的文件
- **THEN** SHALL 返回 `AppError::RawParseError` 错误

#### Scenario: RAF 文件过短
- **WHEN** 传入不足 148 字节的数据
- **THEN** SHALL 返回 `AppError::RawParseError` 错误

### Requirement: RAF 嵌入 JPEG 提取
系统 SHALL 根据 RAF 文件头中读取的 JPEG 偏移量和长度，从文件数据中提取嵌入 JPEG 预览图。提取前 SHALL 验证 JPEG SOI 魔数（`0xFFD8`）。

#### Scenario: 成功提取 RAF 嵌入 JPEG
- **WHEN** 解析一个包含有效嵌入 JPEG 的 RAF 文件
- **THEN** SHALL 返回 JPEG 数据（`Vec<u8>`），数据以 `0xFFD8` 开头

#### Scenario: RAF JPEG SOI 验证失败
- **WHEN** RAF 文件头指示的 JPEG 偏移处不以 `0xFFD8` 开头
- **THEN** SHALL 返回 `AppError::NoEmbeddedJpeg` 错误

#### Scenario: RAF JPEG 偏移或长度越界
- **WHEN** JPEG 偏移量 + 长度超出文件长度
- **THEN** SHALL 返回 `AppError::RawParseError` 错误

### Requirement: RafExtractor 实现
系统 SHALL 实现 `RafExtractor` 结构体，实现 `RawExtractor` trait。`supported_extensions()` SHALL 返回 `["raf"]`，`exif_header_size()` SHALL 返回 65536（64KB）。

#### Scenario: RafExtractor trait 方法
- **WHEN** 创建 `RafExtractor` 实例
- **THEN** `supported_extensions()` SHALL 返回 `["raf"]`，`extract_jpeg()` SHALL 调用 RAF 专用解析逻辑，`extract_metadata()` SHALL 调用通用 Exif 解析器
