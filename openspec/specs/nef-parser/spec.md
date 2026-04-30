## Requirements

### Requirement: TIFF 头解析
系统 SHALL 解析 NEF 文件的前 8 字节 TIFF 头，识别字节序（`II` 小端 / `MM` 大端）和 TIFF 魔数 42（`0x002A`），并获取第一个 IFD 的偏移量。

#### Scenario: 小端 TIFF 头
- **WHEN** 解析一个字节序标记为 `II`（`0x49 0x49`）的 NEF 文件
- **THEN** SHALL 使用小端字节序读取后续数据，TIFF 魔数验证为 42，成功返回 IFD0 偏移量

#### Scenario: 大端 TIFF 头
- **WHEN** 解析一个字节序标记为 `MM`（`0x4D 0x4D`）的 NEF 文件
- **THEN** SHALL 使用大端字节序读取后续数据，TIFF 魔数验证为 42，成功返回 IFD0 偏移量

#### Scenario: 无效 TIFF 头
- **WHEN** 解析一个字节序标记既不是 `II` 也不是 `MM` 的文件，或 TIFF 魔数不是 42
- **THEN** SHALL 返回 `AppError::RawParseError` 错误

#### Scenario: 文件过短
- **WHEN** 传入不足 8 字节的数据
- **THEN** SHALL 返回 `AppError::RawParseError` 错误

### Requirement: IFD 链遍历
系统 SHALL 从 IFD0 开始，遍历整个 IFD 链（通过每个 IFD 末尾的 next IFD offset），解析每个 IFD 中的所有 Entry（tag, type, count, value/offset）。

#### Scenario: 多 IFD 链遍历
- **WHEN** 解析一个包含 IFD0 → IFD1 → 0（终止）的 NEF 文件
- **THEN** SHALL 依次解析 IFD0 和 IFD1 的所有 Entry，当 next offset 为 0 时停止

#### Scenario: IFD 偏移量越界
- **WHEN** IFD 的 next offset 指向超出文件长度的位置
- **THEN** SHALL 停止遍历并返回已解析的 IFD 数据，不 panic

### Requirement: SubIFD 递归解析
系统 SHALL 解析 IFD Entry 中的 SubIFD 指针（tag 0x014A），递归进入 SubIFD 链（SubImage1、SubImage2、SubImage3 等），在每个 SubIFD 中查找嵌入 JPEG 相关标签。

#### Scenario: Nikon NEF SubIFD 解析
- **WHEN** IFD0 包含 SubIFD 指针（tag 0x014A），指向 3 个 SubIFD
- **THEN** SHALL 递归解析所有 3 个 SubIFD，收集每个 SubIFD 中的 JPEGInterchangeFormat 和 JPEGInterchangeFormatLength 标签

### Requirement: 嵌入 JPEG 定位与提取
系统 SHALL 在所有 IFD/SubIFD 中查找包含 `JPEGInterchangeFormat`（tag 0x0201）和 `JPEGInterchangeFormatLength`（tag 0x0202）的 IFD，选择最大的嵌入 JPEG 数据块。提取前 SHALL 验证 JPEG SOI 魔数（`0xFFD8`）。

#### Scenario: 成功提取最大嵌入 JPEG
- **WHEN** 解析一个包含多个嵌入 JPEG 的 NEF 文件（缩略图 + medium 预览）
- **THEN** SHALL 返回最大尺寸的 JPEG 数据（`Vec<u8>`），数据以 `0xFFD8` 开头

#### Scenario: JPEG 魔数验证失败
- **WHEN** JPEGInterchangeFormat 指向的数据偏移处不是 `0xFFD8`
- **THEN** SHALL 跳过该 JPEG 候选，继续检查其他 IFD

#### Scenario: 无嵌入 JPEG
- **WHEN** NEF 文件中所有 IFD/SubIFD 均不包含有效的嵌入 JPEG
- **THEN** SHALL 返回 `AppError::NoEmbeddedJpeg` 错误

#### Scenario: JPEG 数据偏移/长度越界
- **WHEN** JPEGInterchangeFormat + JPEGInterchangeFormatLength 超出文件长度
- **THEN** SHALL 跳过该 JPEG 候选，不 panic

### Requirement: ImageExtractor trait 抽象
系统 SHALL 定义 `ImageExtractor` trait（替代原 `RawExtractor`），包含方法：`supported_extensions() -> &[&str]`、`get_image_data(&self, data: &[u8]) -> Result<Vec<u8>>`（替代原 `extract_jpeg`）、`extract_metadata(&self, data: &[u8]) -> Result<ImageMetadata>`、`exif_header_size() -> usize`。trait MUST 约束 `Send + Sync`。

`get_image_data()` 的语义：RAW 格式返回从容器中提取的嵌入 JPEG 数据；非 RAW 格式（JPEG/PNG/TIFF/WebP）返回原始文件字节。

#### Scenario: NefExtractor 实现 ImageExtractor
- **WHEN** 创建 `NefExtractor` 实例
- **THEN** `supported_extensions()` SHALL 返回 `["nef"]`，`get_image_data()` SHALL 调用 `extract_largest_jpeg()` 提取嵌入 JPEG，`extract_metadata()` SHALL 调用 Exif 解析器，`exif_header_size()` SHALL 返回 65536

#### Scenario: Cr2Extractor 实现 ImageExtractor
- **WHEN** 创建 `Cr2Extractor` 实例
- **THEN** `supported_extensions()` SHALL 返回 `["cr2"]`，`exif_header_size()` SHALL 返回 65536

#### Scenario: ArwExtractor 实现 ImageExtractor
- **WHEN** 创建 `ArwExtractor` 实例
- **THEN** `supported_extensions()` SHALL 返回 `["arw"]`，`exif_header_size()` SHALL 返回 65536

#### Scenario: DngExtractor 实现 ImageExtractor
- **WHEN** 创建 `DngExtractor` 实例
- **THEN** `supported_extensions()` SHALL 返回 `["dng"]`，`exif_header_size()` SHALL 返回 65536

#### Scenario: RafExtractor 实现 ImageExtractor
- **WHEN** 创建 `RafExtractor` 实例
- **THEN** `supported_extensions()` SHALL 返回 `["raf"]`，`exif_header_size()` SHALL 返回 0

#### Scenario: Cr3Extractor 实现 ImageExtractor
- **WHEN** 创建 `Cr3Extractor` 实例
- **THEN** `supported_extensions()` SHALL 返回 `["cr3"]`，`exif_header_size()` SHALL 返回 0

#### Scenario: OrfExtractor 实现 ImageExtractor
- **WHEN** 创建 `OrfExtractor` 实例
- **THEN** `supported_extensions()` SHALL 返回 `["orf"]`，`exif_header_size()` SHALL 返回 65536

#### Scenario: Rw2Extractor 实现 ImageExtractor
- **WHEN** 创建 `Rw2Extractor` 实例
- **THEN** `supported_extensions()` SHALL 返回 `["rw2"]`，`exif_header_size()` SHALL 返回 65536

#### Scenario: PefExtractor 实现 ImageExtractor
- **WHEN** 创建 `PefExtractor` 实例
- **THEN** `supported_extensions()` SHALL 返回 `["pef"]`，`exif_header_size()` SHALL 返回 65536

### Requirement: 格式分发
系统 SHALL 提供一个函数，根据文件扩展名选择对应的 `ImageExtractor` 实现。SHALL 注册所有支持的格式：nef/cr2/cr3/arw/dng/raf/orf/rw2/pef/jpg/jpeg/png/tiff/tif/webp。不支持的扩展名 SHALL 返回 `AppError::ImageParseError` 错误。

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

#### Scenario: .jpg/.jpeg 文件分发
- **WHEN** 传入扩展名为 `.jpg` 或 `.jpeg`（大小写不敏感）的文件
- **THEN** SHALL 选择 `JpegExtractor` 进行处理

#### Scenario: .png 文件分发
- **WHEN** 传入扩展名为 `.png`（大小写不敏感）的文件
- **THEN** SHALL 选择 `PngExtractor` 进行处理

#### Scenario: .tiff/.tif 文件分发
- **WHEN** 传入扩展名为 `.tiff` 或 `.tif`（大小写不敏感）的文件
- **THEN** SHALL 选择 `TiffExtractor` 进行处理

#### Scenario: .webp 文件分发
- **WHEN** 传入扩展名为 `.webp`（大小写不敏感）的文件
- **THEN** SHALL 选择 `WebpExtractor` 进行处理

#### Scenario: 不支持的扩展名
- **WHEN** 传入扩展名不在支持列表中的文件
- **THEN** SHALL 返回 `AppError::ImageParseError` 错误，消息中包含不支持的格式名称

### Requirement: 支持的 RAW 扩展名常量
系统 SHALL 定义 `SUPPORTED_RAW_EXTENSIONS: &[&str]` 常量，包含所有支持的 RAW 文件扩展名（小写，不含点号）：`["arw", "cr2", "cr3", "dng", "nef", "orf", "pef", "raf", "rw2"]`。SHALL 同时定义 `SUPPORTED_IMAGE_EXTENSIONS: &[&str]` 常量，包含非 RAW 图片扩展名：`["jpg", "jpeg", "png", "tiff", "tif", "webp"]`。SHALL 定义 `ALL_SUPPORTED_EXTENSIONS: &[&str]` 常量，包含所有支持的扩展名（RAW + 非RAW）。

#### Scenario: RAW 常量内容
- **WHEN** 引用 `SUPPORTED_RAW_EXTENSIONS` 常量
- **THEN** SHALL 返回包含 9 个 RAW 扩展名的数组

#### Scenario: 图片常量内容
- **WHEN** 引用 `SUPPORTED_IMAGE_EXTENSIONS` 常量
- **THEN** SHALL 返回包含 6 个非 RAW 图片扩展名的数组

#### Scenario: 全量常量内容
- **WHEN** 引用 `ALL_SUPPORTED_EXTENSIONS` 常量
- **THEN** SHALL 返回包含 15 个扩展名的数组

### Requirement: RAW 扩展名判断函数
系统 SHALL 提供 `is_raw_extension(extension: &str) -> bool` 函数（大小写不敏感），用于判断是否为 RAW 格式。SHALL 同时提供 `is_supported_extension(extension: &str) -> bool` 函数，判断是否为任何支持的图片格式。

#### Scenario: RAW 扩展名判断
- **WHEN** 调用 `is_raw_extension("nef")`
- **THEN** SHALL 返回 `true`

#### Scenario: 非 RAW 图片扩展名通过 is_supported_extension
- **WHEN** 调用 `is_supported_extension("jpg")` 或 `is_supported_extension("png")` 或 `is_supported_extension("webp")`
- **THEN** SHALL 返回 `true`

#### Scenario: 非 RAW 图片扩展名不通过 is_raw_extension
- **WHEN** 调用 `is_raw_extension("jpg")` 或 `is_raw_extension("png")`
- **THEN** SHALL 返回 `false`

#### Scenario: 不支持的扩展名
- **WHEN** 调用 `is_supported_extension("txt")` 或 `is_supported_extension("pdf")`
- **THEN** SHALL 返回 `false`
