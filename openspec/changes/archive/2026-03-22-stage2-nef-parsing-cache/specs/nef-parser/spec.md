## ADDED Requirements

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
- **THEN** SHALL 返回 `AppError::NefParseError` 错误

#### Scenario: 文件过短
- **WHEN** 传入不足 8 字节的数据
- **THEN** SHALL 返回 `AppError::NefParseError` 错误

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

### Requirement: RawExtractor trait 抽象
系统 SHALL 定义 `RawExtractor` trait，包含方法：`supported_extensions() -> &[&str]`、`extract_jpeg(&self, data: &[u8]) -> Result<Vec<u8>>`、`extract_metadata(&self, data: &[u8]) -> Result<ImageMetadata>`。trait MUST 约束 `Send + Sync`。

#### Scenario: NefExtractor 实现 RawExtractor
- **WHEN** 创建 `NefExtractor` 实例
- **THEN** `supported_extensions()` SHALL 返回 `["nef"]`，`extract_jpeg()` 和 `extract_metadata()` SHALL 分别调用 NEF 解析器和 Exif 解析器

### Requirement: 格式分发
系统 SHALL 提供一个函数，根据文件扩展名选择对应的 `RawExtractor` 实现。当前仅注册 `NefExtractor`。

#### Scenario: .nef 文件分发
- **WHEN** 传入扩展名为 `.nef`（大小写不敏感）的文件
- **THEN** SHALL 选择 `NefExtractor` 进行处理

#### Scenario: 不支持的扩展名
- **WHEN** 传入扩展名为 `.cr2` 或其他未注册格式的文件
- **THEN** SHALL 返回错误表示不支持的格式
