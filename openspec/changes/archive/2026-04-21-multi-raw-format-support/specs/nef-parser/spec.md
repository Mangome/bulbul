## MODIFIED Requirements

### Requirement: RawExtractor trait 抽象
系统 SHALL 定义 `RawExtractor` trait，包含方法：`supported_extensions() -> &[&str]`、`extract_jpeg(&self, data: &[u8]) -> Result<Vec<u8>>`、`extract_metadata(&self, data: &[u8]) -> Result<ImageMetadata>`、`exif_header_size() -> usize`。trait MUST 约束 `Send + Sync`。

#### Scenario: NefExtractor 实现 RawExtractor
- **WHEN** 创建 `NefExtractor` 实例
- **THEN** `supported_extensions()` SHALL 返回 `["nef"]`，`extract_jpeg()` 和 `extract_metadata()` SHALL 分别调用 NEF 解析器和 Exif 解析器，`exif_header_size()` SHALL 返回 65536

#### Scenario: Cr2Extractor 实现 RawExtractor
- **WHEN** 创建 `Cr2Extractor` 实例
- **THEN** `supported_extensions()` SHALL 返回 `["cr2"]`，`exif_header_size()` SHALL 返回 65536

#### Scenario: ArwExtractor 实现 RawExtractor
- **WHEN** 创建 `ArwExtractor` 实例
- **THEN** `supported_extensions()` SHALL 返回 `["arw"]`，`exif_header_size()` SHALL 返回 65536

#### Scenario: DngExtractor 实现 RawExtractor
- **WHEN** 创建 `DngExtractor` 实例
- **THEN** `supported_extensions()` SHALL 返回 `["dng"]`，`exif_header_size()` SHALL 返回 65536

#### Scenario: RafExtractor 实现 RawExtractor
- **WHEN** 创建 `RafExtractor` 实例
- **THEN** `supported_extensions()` SHALL 返回 `["raf"]`，`exif_header_size()` SHALL 返回 65536

#### Scenario: Cr3Extractor 实现 RawExtractor
- **WHEN** 创建 `Cr3Extractor` 实例
- **THEN** `supported_extensions()` SHALL 返回 `["cr3"]`，`exif_header_size()` SHALL 返回 0

#### Scenario: OrfExtractor 实现 RawExtractor
- **WHEN** 创建 `OrfExtractor` 实例
- **THEN** `supported_extensions()` SHALL 返回 `["orf"]`，`exif_header_size()` SHALL 返回 65536

#### Scenario: Rw2Extractor 实现 RawExtractor
- **WHEN** 创建 `Rw2Extractor` 实例
- **THEN** `supported_extensions()` SHALL 返回 `["rw2"]`，`exif_header_size()` SHALL 返回 65536

#### Scenario: PefExtractor 实现 RawExtractor
- **WHEN** 创建 `PefExtractor` 实例
- **THEN** `supported_extensions()` SHALL 返回 `["pef"]`，`exif_header_size()` SHALL 返回 65536

### Requirement: 格式分发
系统 SHALL 提供一个函数，根据文件扩展名选择对应的 `RawExtractor` 实现。SHALL 注册所有支持的格式：nef/cr2/cr3/arw/dng/raf/orf/rw2/pef。

#### Scenario: .nef 文件分发
- **WHEN** 传入扩展名为 `.nef`（大小写不敏感）的文件
- **THEN** SHALL 选择 `NefExtractor` 进行处理

#### Scenario: .cr2 文件分发
- **WHEN** 传入扩展名为 `.cr2`（大小写不敏感）的文件
- **THEN** SHALL 选择 `Cr2Extractor` 进行处理

#### Scenario: .cr3 文件分发
- **WHEN** 传入扩展名为 `.cr3`（大小写不敏感）的文件
- **THEN** SHALL 选择 `Cr3Extractor` 进行处理

#### Scenario: .arw 文件分发
- **WHEN** 传入扩展名为 `.arw`（大小写不敏感）的文件
- **THEN** SHALL 选择 `ArwExtractor` 进行处理

#### Scenario: .dng 文件分发
- **WHEN** 传入扩展名为 `.dng`（大小写不敏感）的文件
- **THEN** SHALL 选择 `DngExtractor` 进行处理

#### Scenario: .raf 文件分发
- **WHEN** 传入扩展名为 `.raf`（大小写不敏感）的文件
- **THEN** SHALL 选择 `RafExtractor` 进行处理

#### Scenario: .orf 文件分发
- **WHEN** 传入扩展名为 `.orf`（大小写不敏感）的文件
- **THEN** SHALL 选择 `OrfExtractor` 进行处理

#### Scenario: .rw2 文件分发
- **WHEN** 传入扩展名为 `.rw2`（大小写不敏感）的文件
- **THEN** SHALL 选择 `Rw2Extractor` 进行处理

#### Scenario: .pef 文件分发
- **WHEN** 传入扩展名为 `.pef`（大小写不敏感）的文件
- **THEN** SHALL 选择 `PefExtractor` 进行处理

#### Scenario: 不支持的扩展名
- **WHEN** 传入扩展名不在支持列表中的文件
- **THEN** SHALL 返回 `AppError::RawParseError` 错误，消息中包含不支持的格式名称

## ADDED Requirements

### Requirement: 支持的 RAW 扩展名常量
系统 SHALL 定义 `SUPPORTED_RAW_EXTENSIONS: &[&str]` 常量，包含所有支持的 RAW 文件扩展名（小写，不含点号）：`["nef", "cr2", "cr3", "arw", "dng", "raf", "orf", "rw2", "pef"]`。

#### Scenario: 常量内容
- **WHEN** 引用 `SUPPORTED_RAW_EXTENSIONS` 常量
- **THEN** SHALL 返回包含 9 个扩展名的数组，按字母序排列

### Requirement: RAW 扩展名判断函数
系统 SHALL 提供 `is_raw_extension(extension: &str) -> bool` 函数，大小写不敏感地判断给定扩展名是否属于支持的 RAW 格式。

#### Scenario: 支持的扩展名
- **WHEN** 调用 `is_raw_extension("nef")` 或 `is_raw_extension("NEF")` 或 `is_raw_extension("Nef")`
- **THEN** SHALL 返回 `true`

#### Scenario: 不支持的扩展名
- **WHEN** 调用 `is_raw_extension("jpg")` 或 `is_raw_extension("png")`
- **THEN** SHALL 返回 `false`

## REMOVED Requirements

### Requirement: NefExtractor 实现 RawExtractor 中的 NEF 专属分发限制
**Reason**: `get_extractor()` 已扩展支持所有 9 种 RAW 格式，不再仅限 NEF
**Migration**: 使用新的 `get_extractor()` 函数，传入任意支持的扩展名即可获取对应 Extractor

## RENAMED Requirements

FROM: `NefParseError` 错误类型
TO: `RawParseError` 错误类型
