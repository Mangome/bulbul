## Requirements

### Requirement: 单文件 RAW 处理
系统 SHALL 提供 `process_single_raw` 函数，接受 RAW 文件路径和缓存目录路径，协调调用 NEF 解析器提取嵌入 JPEG、Exif 解析器提取元数据、image crate 生成缩略图，并将结果写入缓存目录。

#### Scenario: 成功处理一个 NEF 文件
- **WHEN** 传入一个有效的 `.nef` 文件路径和缓存目录路径，该文件未被缓存
- **THEN** SHALL 依次完成：1) 读取文件字节 2) 提取嵌入 JPEG 3) 解析 Exif 元数据 4) 保存 medium JPEG 到 `{cache_dir}/medium/{hash}.jpg` 5) 生成 200px 缩略图到 `{cache_dir}/thumbnail/{hash}.jpg`，返回处理结果包含 hash、ImageMetadata、缓存路径

#### Scenario: 已缓存文件跳过 JPEG 提取
- **WHEN** 传入一个已被缓存的 `.nef` 文件路径（medium 和 thumbnail 文件均存在）
- **THEN** SHALL 跳过 JPEG 提取和缩略图生成，仅解析 Exif 元数据（如果 metadata 未缓存），返回缓存的文件路径

#### Scenario: NEF 解析失败
- **WHEN** 传入一个损坏的 `.nef` 文件
- **THEN** SHALL 返回错误，不写入任何缓存文件

### Requirement: 缩略图生成
系统 SHALL 将提取的嵌入 JPEG 解码后，缩放到 200px 宽（保持宽高比，使用 Lanczos3 插值），以 JPEG quality=85 编码并保存。

#### Scenario: 横向图片缩略图
- **WHEN** 输入一张 1920×1280 的 JPEG 图片
- **THEN** 生成的缩略图宽度 SHALL 为 200px，高度 SHALL 约为 133px（保持 3:2 比例）

#### Scenario: 纵向图片缩略图
- **WHEN** 输入一张 1280×1920 的 JPEG 图片
- **THEN** 生成的缩略图宽度 SHALL 为 200px，高度 SHALL 约为 300px（保持 2:3 比例）

#### Scenario: 小于 200px 宽的图片
- **WHEN** 输入一张宽度小于 200px 的图片
- **THEN** SHALL 保持原尺寸不放大

### Requirement: Medium JPEG 保存
系统 SHALL 将从 NEF 中提取的嵌入 JPEG 原始数据直接写入 `{cache_dir}/medium/{hash}.jpg`，不做额外处理。

#### Scenario: Medium 图片保存
- **WHEN** 成功从 NEF 提取嵌入 JPEG 数据
- **THEN** 写入的文件内容 SHALL 与提取的原始 JPEG 字节完全一致

### Requirement: 处理结果数据结构
系统 SHALL 为单文件处理定义结果结构体，包含：文件哈希（hash）、原始文件名（filename）、原始文件路径（file_path）、ImageMetadata、medium 缓存路径、thumbnail 缓存路径。

#### Scenario: 处理结果完整性
- **WHEN** 成功处理一个 NEF 文件
- **THEN** 结果 SHALL 包含所有字段，hash 为 MD5(规范化绝对路径) 的十六进制字符串
