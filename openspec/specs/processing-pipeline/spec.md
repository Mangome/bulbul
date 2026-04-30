## Requirements

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

#### Scenario: 缓存部分命中

- **WHEN** 调用 `process_folder` 且部分图片缓存缺失或指纹不匹配
- **THEN** SHALL 仅对缺失图片执行阶段 2-3，与缓存命中的结果合并后重新执行分组

#### Scenario: 强制刷新

- **WHEN** 调用 `process_folder` 且 `force_refresh = true`
- **THEN** SHALL 跳过缓存检查，执行完整流水线

#### Scenario: 缓存写入阶段 2

- **WHEN** 阶段 2 处理完一张图片
- **THEN** SHALL 调用 `save_image_result()` 保存该图片的 ProcessResult

#### Scenario: 缓存写入阶段 5

- **WHEN** 阶段 5 构建完 GroupResult
- **THEN** SHALL 调用 `save_group_cache()` 保存目录分组缓存

#### Scenario: 缓存写入阶段 6

- **WHEN** 阶段 6 为一张图片完成 FocusScoring
- **THEN** SHALL 更新该图片的 `ImageResultCache.metadata` 并保存

#### Scenario: 空文件夹

- **WHEN** 提供的文件夹中没有支持的图片格式文件
- **THEN** 返回空的 `GroupResult`（groups 为空，total_images 为 0），状态直接变为 Completed，不执行 FocusScoring

#### Scenario: FocusScoring 后台执行

- **WHEN** 流水线完成到 Completed 阶段并返回 GroupResult
- **THEN** FocusScoring 继续在后台异步执行，不影响主流程

### Requirement: FocusScoring 后台阶段

在 Completed 状态返回后，系统 SHALL 启动后台任务执行 FocusScoring 阶段：为每张图片执行 YOLOv8s 检测 → 鸟种分类（含地理过滤）→ 区域合焦评分 → 更新元数据缓存。并发数由 Semaphore 限制 ≤ min(4, CPU核数)。鸟种分类时 SHALL 从元数据缓存中提取 GPS 坐标并传入分类函数。

#### Scenario: FocusScoring 后台启动

- **WHEN** 流水线返回 GroupResult（state = Completed）
- **THEN** 后台任务立即启动，为每张 medium JPEG 执行检测

#### Scenario: GPS 坐标传递到分类

- **WHEN** 一张图片的 `ImageMetadata.gps_latitude` 和 `gps_longitude` 均 Some
- **THEN** 将 (gps_latitude, gps_longitude) 作为 `gps: Option<(f64, f64)>` 传入 `classify_detections()`

#### Scenario: 无 GPS 数据时降级

- **WHEN** 一张图片的 GPS 字段为 None
- **THEN** 传入 gps=None，分类不应用地理过滤

#### Scenario: 并发限制

- **WHEN** 系统有 100 张图片需要处理
- **THEN** 最多同时执行 4 个检测任务（Semaphore），其余任务排队

#### Scenario: 单张处理耗时

- **WHEN** 处理一张 medium JPEG（512px 长边）
- **THEN** 检测 (50-150ms) + 分类 (30-80ms) + 合焦评分计算 (10-30ms) = 总计 90-260ms

### Requirement: 分阶段进度事件推送

流水线及 FocusScoring 后台 SHALL 在关键点推送进度事件。FocusScoring 阶段推送 `focus-score-update` 事件，包含 hash、score（可为 null）、method。

#### Scenario: FocusScoring 完成一张

- **WHEN** 后台为一张图片完成检测和评分
- **THEN** emit 事件 `focus-score-update`，payload = `{ hash: "abc123", score: 4, method: "BirdRegion" }`

#### Scenario: 检测失败事件

- **WHEN** 检测失败，无法识别鸟
- **THEN** emit 事件 `focus-score-update`，payload = `{ hash: "abc123", score: null, method: "Undetected" }`

#### Scenario: 前期阶段事件不变

- **WHEN** Scanning/Processing/Analyzing/Grouping 阶段执行
- **THEN** 推送 `processing-progress` 事件（同现有行为），state 为对应的阶段名

### Requirement: 取消支持（FocusScoring 阶段）

FocusScoring 后台任务 SHALL 定期检查 `cancel_flag`，取消后停止启动新的检测任务，等待已启动任务完成。

#### Scenario: FocusScoring 阶段取消

- **WHEN** 流水线返回后用户点击"取消"，或新流程启动时还有 FocusScoring 任务在运行
- **THEN** 停止启动新的检测任务，等待已启动的完成，部分结果已更新到缓存

#### Scenario: 取消后再次启动

- **WHEN** 取消后重新调用 `process_folder`
- **THEN** 新流程启动，FocusScoring 后台独立运行（不与旧任务冲突）

### Requirement: 元数据缓存同步

FocusScoring 每完成一张图片，SHALL 立即更新 `SessionState.metadata_cache` 中对应 hash 的 `detection_bboxes` 和 `focus_score_method` 字段。

#### Scenario: 缓存即时更新

- **WHEN** 后台完成一张图片的检测
- **THEN** 同步更新 `SessionState.metadata_cache[hash]`，前端后续调用 `get_metadata` 可获得最新数据

#### Scenario: 并发安全

- **WHEN** 多个 FocusScoring 任务并发更新缓存
- **THEN** 使用 Mutex/RwLock 保证并发安全，无数据竞争

### Requirement: Analyzing 阶段并发

Analyzing 阶段 SHALL 使用 `tokio::task::spawn_blocking` + Semaphore（8 路并发）并发计算 pHash。每张图片的 pHash 计算基于已缓存的缩略图。不同 RAW 格式的图片 SHALL 混合参与并发计算。

#### Scenario: 并发限制

- **WHEN** 同时有超过 8 张图片需要计算 pHash
- **THEN** 最多同时执行 8 个 pHash 计算任务

#### Scenario: 混合格式并发

- **WHEN** 同时有 NEF 和 CR2 文件的缩略图需要计算 pHash
- **THEN** 两种格式的图片混合排队，最多同时执行 8 个 pHash 计算任务

### Requirement: 图片排序

流水线在 Analyzing 阶段之前 SHALL 按 `(capture_time, filename)` 对处理结果排序，确保分组算法输入有序。缺少 `capture_time` 的图片排在最后。

#### Scenario: 按时间排序

- **WHEN** 多张图片有不同的拍摄时间
- **THEN** 按拍摄时间升序排列后传入分组算法

#### Scenario: 时间相同按文件名排序

- **WHEN** 多张图片拍摄时间相同
- **THEN** 按文件名字母序排列

### Requirement: 性能指标收集

流水线 SHALL 记录每个阶段的耗时，填入 `PerformanceMetrics` 结构（`scan_time_ms`、`process_time_ms`、`similarity_time_ms`、`grouping_time_ms`、`total_time_ms`）。

#### Scenario: 性能数据完整

- **WHEN** 流水线完成
- **THEN** `GroupResult.performance` 中所有时间字段 ≥ 0，且 `total_time_ms` ≥ 各阶段之和

### Requirement: SessionState 更新

流水线完成后 SHALL 将 `GroupResult` 存入 `SessionState.group_result`，同时更新双向映射和元数据缓存。

#### Scenario: 分组结果持久化

- **WHEN** 流水线成功完成
- **THEN** `SessionState.group_result` 为 `Some(GroupResult)`，且 `processing_state` 为 Completed

### Requirement: 取消支持

流水线 SHALL 在 Processing 和 Analyzing 阶段的每次迭代中检查 `cancel_flag`。取消后停止后续处理，将已完成的结果更新到 `SessionState`，状态变为 Cancelled。已写入磁盘的缓存文件 SHALL 保留（部分结果仍有价值）。

#### Scenario: 处理阶段取消

- **WHEN** 在 Processing 阶段触发取消
- **THEN** 停止启动新的 RAW 文件处理任务，等待已启动的任务完成，返回已处理的部分结果

#### Scenario: 分析阶段取消

- **WHEN** 在 Analyzing 阶段触发取消
- **THEN** 停止后续 pHash 计算，跳过分组阶段，返回已有的处理结果

### Requirement: 统一图片文件扫描函数
系统 SHALL 提供私有函数 `scan_image_files_internal(folder: &Path) -> Result<Vec<PathBuf>>`（替代原 `scan_raw_files_internal`），扫描指定目录下所有支持的图片格式文件（使用 `ALL_SUPPORTED_EXTENSIONS` 常量，大小写不敏感，非递归）。

#### Scenario: 多格式扫描
- **WHEN** 调用 `scan_image_files_internal` 传入包含 .nef、.cr2、.jpg、.png 文件的目录
- **THEN** SHALL 返回所有四种格式的文件路径

#### Scenario: 大小写不敏感
- **WHEN** 目录中包含 `.NEF` 和 `.JPG` 文件
- **THEN** SHALL 均被识别并返回
