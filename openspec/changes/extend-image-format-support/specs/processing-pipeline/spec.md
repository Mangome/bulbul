## MODIFIED Requirements

### Requirement: 端到端处理流水线

`process_folder` 命令 SHALL 实现完整的 6 阶段流水线：Scanning（扫描所有支持的图片格式文件）→ Processing（获取图像数据 + Exif + 缩略图）→ Analyzing（计算 pHash + 相似度）→ Grouping（执行分组算法）→ Completed（完成）→ **FocusScoring（后台异步计算合焦评分）**。最终返回 `GroupResult`，FocusScoring 不阻塞返回。

`process_folder` SHALL 新增 `force_refresh: Option<bool>` 参数。当 `force_refresh` 不为 `true` 时，SHALL 在流水线执行前检查缓存：

1. 扫描目录获取文件列表后，计算每个文件的 hash 和 fingerprint
2. 尝试加载目录分组缓存 (`DirectoryGroupCache`)
3. 若目录缓存存在，逐个加载 `ImageResultCache` 并验证 fingerprint
4. 将文件分为 cached（缓存命中且指纹匹配）和 missing（缓存缺失或指纹不匹配）
5. 全部命中：恢复 SessionState，直接返回 GroupResult，若 detection_cache 不完整则在后台启动 FocusScoring
6. 部分命中：仅对 missing 图片执行阶段 2-3，与 cached 结果合并后重新分组
7. 全部缺失或目录缓存不存在：走完整流水线

流水线各阶段完成后 SHALL 写入缓存：
- 阶段 2 每个 ProcessResult 完成后 → `save_image_result()`
- 阶段 3 pHash 计算完成后 → 更新对应 image_result 的 phash 字段并保存
- 阶段 5 完成后 → `save_group_cache()`
- 阶段 6 每张图片 FocusScoring 完成后 → 更新 image_result 的 metadata 并保存

#### Scenario: 完整流水线执行（多格式）

- **WHEN** 调用 `process_folder` 并提供一个包含 NEF、JPEG 和 PNG 文件的文件夹路径
- **THEN** 依次经过 Scanning → Processing → Analyzing → Grouping → Completed 五个阶段返回 GroupResult，同时在后台启动 FocusScoring 阶段

#### Scenario: 缓存全部命中

- **WHEN** 调用 `process_folder` 且所有图片的结果缓存均存在且指纹匹配
- **THEN** SHALL 跳过阶段 2-4，直接恢复 SessionState 并返回缓存的 GroupResult

#### Scenario: 空文件夹

- **WHEN** 提供的文件夹中没有支持的图片格式文件
- **THEN** 返回空的 `GroupResult`（groups 为空，total_images 为 0），状态直接变为 Completed，不执行 FocusScoring

### Requirement: 统一图片文件扫描函数
系统 SHALL 提供私有函数 `scan_image_files_internal(folder: &Path) -> Result<Vec<PathBuf>>`（替代原 `scan_raw_files_internal`），扫描指定目录下所有支持的图片格式文件（使用 `ALL_SUPPORTED_EXTENSIONS` 常量，大小写不敏感，非递归）。

#### Scenario: 多格式扫描
- **WHEN** 调用 `scan_image_files_internal` 传入包含 .nef、.cr2、.jpg、.png 文件的目录
- **THEN** SHALL 返回所有四种格式的文件路径

#### Scenario: 大小写不敏感
- **WHEN** 目录中包含 `.NEF` 和 `.JPG` 文件
- **THEN** SHALL 均被识别并返回
