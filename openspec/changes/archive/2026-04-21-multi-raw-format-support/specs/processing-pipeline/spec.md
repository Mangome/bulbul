## MODIFIED Requirements

### Requirement: 端到端处理流水线

`process_folder` 命令 SHALL 实现完整的 6 阶段流水线：Scanning（扫描所有支持的 RAW 格式文件）→ Processing（提取 JPEG + Exif + 缩略图）→ Analyzing（计算 pHash + 相似度）→ Grouping（执行分组算法）→ Completed（完成）→ **FocusScoring（后台异步计算合焦评分）**。最终返回 `GroupResult`，FocusScoring 不阻塞返回。

#### Scenario: 完整流水线执行

- **WHEN** 调用 `process_folder` 并提供一个包含 NEF 和 CR2 文件的文件夹路径
- **THEN** 依次经过 Scanning → Processing → Analyzing → Grouping → Completed 五个阶段返回 GroupResult，同时在后台启动 FocusScoring 阶段

#### Scenario: 空文件夹

- **WHEN** 提供的文件夹中没有支持的 RAW 格式文件
- **THEN** 返回空的 `GroupResult`（groups 为空，total_images 为 0），状态直接变为 Completed，不执行 FocusScoring

#### Scenario: 混合格式文件夹

- **WHEN** 提供的文件夹同时包含 .nef、.cr2、.arw 等多种 RAW 格式文件
- **THEN** SHALL 统一扫描所有格式，按各自格式对应的 Extractor 处理，最终合并到同一组 GroupResult 中

### Requirement: Analyzing 阶段并发

Analyzing 阶段 SHALL 使用 `tokio::task::spawn_blocking` + Semaphore（8 路并发）并发计算 pHash。每张图片的 pHash 计算基于已缓存的缩略图。不同 RAW 格式的图片 SHALL 混合参与并发计算。

#### Scenario: 混合格式并发

- **WHEN** 同时有 NEF 和 CR2 文件的缩略图需要计算 pHash
- **THEN** 两种格式的图片混合排队，最多同时执行 8 个 pHash 计算任务

## ADDED Requirements

### Requirement: 统一 RAW 文件扫描函数
系统 SHALL 提供私有函数 `scan_raw_files_internal(folder: &Path) -> Result<Vec<PathBuf>>`，扫描指定目录下所有支持的 RAW 格式文件（使用 `SUPPORTED_RAW_EXTENSIONS` 常量，大小写不敏感，非递归）。该函数 SHALL 替代现有的 `scan_nef_files()` 函数。

#### Scenario: 多格式扫描
- **WHEN** 调用 `scan_raw_files_internal` 传入包含 .nef、.cr2、.arw 文件的目录
- **THEN** SHALL 返回所有三种格式的文件路径

#### Scenario: 大小写不敏感
- **WHEN** 目录中包含 `.NEF` 和 `.Cr2` 文件
- **THEN** SHALL 均被识别并返回

## REMOVED Requirements

### Requirement: scan_nef_files 函数
**Reason**: 已被通用的 `scan_raw_files_internal()` 函数取代，不再仅扫描 NEF 格式
**Migration**: 使用 `scan_raw_files_internal()` 替代所有对 `scan_nef_files()` 的调用
