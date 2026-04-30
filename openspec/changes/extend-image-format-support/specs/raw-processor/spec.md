## MODIFIED Requirements

### Requirement: 单文件 RAW 处理
系统 SHALL 提供 `process_single_image` 函数（替代原 `process_single_raw`），接受图片文件路径和缓存目录路径，根据文件扩展名选择对应的 `ImageExtractor`，协调调用获取图像数据、Exif 解析器提取元数据、image crate 生成缩略图，并将结果写入缓存目录。SHALL 同时提供 `pub use process_single_image as process_single_raw;` 别名以兼容现有调用。

#### Scenario: 成功处理一个 NEF 文件
- **WHEN** 传入一个有效的 `.nef` 文件路径和缓存目录路径，该文件未被缓存
- **THEN** SHALL 依次完成：1) 读取文件字节 2) 通过 NefExtractor 的 `get_image_data()` 提取嵌入 JPEG 3) 解析 Exif 元数据 4) 保存 medium JPEG 5) 生成缩略图，返回处理结果

#### Scenario: 成功处理一个 JPEG 文件
- **WHEN** 传入一个有效的 `.jpg` 文件路径和缓存目录路径，该文件未被缓存
- **THEN** SHALL 通过 JpegExtractor 的 `get_image_data()` 获取原始文件字节，`generate_medium()` 和 `generate_thumbnail()` 使用 `image::load_from_memory()` 解码 JPEG 数据

#### Scenario: 成功处理一个 PNG 文件
- **WHEN** 传入一个有效的 `.png` 文件路径和缓存目录路径，该文件未被缓存
- **THEN** SHALL 通过 PngExtractor 的 `get_image_data()` 获取原始文件字节，`generate_medium()` 和 `generate_thumbnail()` 使用 `image::load_from_memory()` 解码 PNG 数据

#### Scenario: 成功处理一个 TIFF 文件
- **WHEN** 传入一个有效的 `.tiff` 文件路径和缓存目录路径，该文件未被缓存
- **THEN** SHALL 通过 TiffExtractor 的 `get_image_data()` 获取原始文件字节，`generate_medium()` 和 `generate_thumbnail()` 使用 `image::load_from_memory()` 解码 TIFF 数据

#### Scenario: 成功处理一个 WebP 文件
- **WHEN** 传入一个有效的 `.webp` 文件路径和缓存目录路径，该文件未被缓存
- **THEN** SHALL 通过 WebpExtractor 的 `get_image_data()` 获取原始文件字节，`generate_medium()` 和 `generate_thumbnail()` 使用 `image::load_from_memory()` 解码 WebP 数据

#### Scenario: 已缓存文件跳过图像数据获取
- **WHEN** 传入一个已被缓存的图片文件路径（medium 和 thumbnail 文件均存在）
- **THEN** SHALL 跳过图像数据获取和缩略图生成，仅解析 Exif 元数据，返回缓存的文件路径

#### Scenario: 非 RAW 格式缓存命中全量读取
- **WHEN** 传入一个已缓存的 `.jpg` 文件路径
- **THEN** SHALL 全量读取文件解析 EXIF（因非 RAW 格式的 `exif_header_size()` 为 0）

#### Scenario: 解析失败
- **WHEN** 传入一个损坏的图片文件
- **THEN** SHALL 返回 `AppError::ImageParseError` 错误，不写入任何缓存文件

### Requirement: 缩略图生成
系统 SHALL 将获取的图像数据解码后（通过 `image::load_from_memory()`，支持 JPEG/PNG/TIFF/WebP），缩放到 600px 长边（保持宽高比，使用 Lanczos3 插值，不放大），以 JPEG quality=80 编码并保存。

#### Scenario: 横向图片缩略图
- **WHEN** 输入一张 1920×1280 的 JPEG 图片
- **THEN** 生成的缩略图宽度 SHALL 为 600px，高度 SHALL 约为 400px（保持 3:2 比例）

#### Scenario: PNG 输入缩略图
- **WHEN** 输入一张 1920×1280 的 PNG 图片
- **THEN** SHALL 成功解码并生成 600px 宽的 JPEG 缩略图

#### Scenario: 小于 600px 长边的图片
- **WHEN** 输入一张宽度小于 600px 的图片
- **THEN** SHALL 保持原尺寸不放大

### Requirement: Medium JPEG 保存
系统 SHALL 将获取的图像数据通过 `image::load_from_memory()` 解码后，缩放到最大宽度 2560px（保持宽高比，使用 Lanczos3 插值，不放大），以 JPEG quality=80 编码并保存到 `{cache_dir}/medium/{hash}.jpg`。

#### Scenario: Medium 图片保存
- **WHEN** 成功获取图像数据
- **THEN** 写入的文件 SHALL 为 JPEG 格式，最大宽度 2560px

#### Scenario: PNG 转 Medium JPEG
- **WHEN** 输入为 PNG 格式
- **THEN** SHALL 解码 PNG 并编码为 JPEG 保存

### Requirement: 处理结果数据结构
系统 SHALL 为单文件处理定义结果结构体，包含：文件哈希（hash）、原始文件名（filename）、原始文件路径（file_path）、ImageMetadata、medium 缓存路径、thumbnail 缓存路径。

#### Scenario: 处理结果完整性
- **WHEN** 成功处理一个图片文件
- **THEN** 结果 SHALL 包含所有字段，hash 为 MD5(规范化绝对路径) 的十六进制字符串
