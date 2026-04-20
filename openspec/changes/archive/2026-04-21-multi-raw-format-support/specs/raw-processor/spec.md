## MODIFIED Requirements

### Requirement: 单文件 RAW 处理
系统 SHALL 提供 `process_single_raw` 函数，接受 RAW 文件路径和缓存目录路径，根据文件扩展名选择对应的 `RawExtractor`，协调调用提取嵌入 JPEG、Exif 解析器提取元数据、image crate 生成缩略图，并将结果写入缓存目录。

#### Scenario: 成功处理一个 NEF 文件
- **WHEN** 传入一个有效的 `.nef` 文件路径和缓存目录路径，该文件未被缓存
- **THEN** SHALL 依次完成：1) 读取文件字节 2) 通过 NefExtractor 提取嵌入 JPEG 3) 解析 Exif 元数据 4) 保存 medium JPEG 5) 生成缩略图，返回处理结果

#### Scenario: 成功处理一个 CR2 文件
- **WHEN** 传入一个有效的 `.cr2` 文件路径和缓存目录路径，该文件未被缓存
- **THEN** SHALL 通过 Cr2Extractor 提取嵌入 JPEG，后续流程与 NEF 相同

#### Scenario: 成功处理一个 CR3 文件
- **WHEN** 传入一个有效的 `.cr3` 文件路径和缓存目录路径，该文件未被缓存
- **THEN** SHALL 通过 Cr3Extractor 提取嵌入 JPEG，后续流程与 NEF 相同

#### Scenario: 已缓存文件跳过 JPEG 提取
- **WHEN** 传入一个已被缓存的 RAW 文件路径（medium 和 thumbnail 文件均存在）
- **THEN** SHALL 跳过 JPEG 提取和缩略图生成，仅解析 Exif 元数据（如果 metadata 未缓存），返回缓存的文件路径

#### Scenario: CR3 缓存命中的 Exif 读取
- **WHEN** 传入一个已缓存的 `.cr3` 文件路径
- **THEN** SHALL 全量读取文件解析 Exif（因 CR3 的 `exif_header_size()` 为 0），不能仅读取头部

#### Scenario: RAW 解析失败
- **WHEN** 传入一个损坏的 RAW 文件
- **THEN** SHALL 返回 `AppError::RawParseError` 错误，不写入任何缓存文件
