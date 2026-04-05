## Requirements

### Requirement: 端到端处理流水线

`process_folder` 命令 SHALL 实现完整的 6 阶段流水线：Scanning（扫描 NEF 文件）→ Processing（提取 JPEG + Exif + 缩略图）→ Analyzing（计算 pHash + 相似度）→ Grouping（执行分组算法）→ Completed（完成）→ **FocusScoring（后台异步计算合焦评分）**。最终返回 `GroupResult`，FocusScoring 不阻塞返回。

#### Scenario: 完整流水线执行

- **WHEN** 调用 `process_folder` 并提供一个包含 NEF 文件的文件夹路径
- **THEN** 依次经过 Scanning → Processing → Analyzing → Grouping → Completed 五个阶段返回 GroupResult，同时在后台启动 FocusScoring 阶段（异步，不阻塞返回）

#### Scenario: 空文件夹

- **WHEN** 提供的文件夹中没有 NEF 文件
- **THEN** 返回空的 `GroupResult`（groups 为空，total_images 为 0），状态直接变为 Completed，不执行 FocusScoring

#### Scenario: FocusScoring 后台执行

- **WHEN** 流水线完成到 Completed 阶段并返回 GroupResult
- **THEN** FocusScoring 继续在后台异步执行，不影响主流程

### Requirement: FocusScoring 后台阶段

在 Completed 状态返回后，系统 SHALL 启动后台任务执行 FocusScoring 阶段：为每张图片执行 YOLOv8s 检测 → 区域合焦评分 → 更新元数据缓存。并发数由 Semaphore 限制 ≤ min(4, CPU核数)。

#### Scenario: FocusScoring 后台启动

- **WHEN** 流水线返回 GroupResult（state = Completed）
- **THEN** 后台任务立即启动，为每张 medium JPEG 执行检测

#### Scenario: 并发限制

- **WHEN** 系统有 100 张图片需要处理
- **THEN** 最多同时执行 4 个检测任务（Semaphore），其余任务排队

#### Scenario: 单张处理耗时

- **WHEN** 处理一张 medium JPEG（512px 长边）
- **THEN** 检测 (50-150ms) + 合焦评分计算 (10-30ms) = 总计 60-180ms

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

Analyzing 阶段 SHALL 使用 `tokio::task::spawn_blocking` + Semaphore（8 路并发）并发计算 pHash。每张图片的 pHash 计算基于已缓存的 200px 缩略图。

#### Scenario: 并发限制

- **WHEN** 同时有超过 8 张图片需要计算 pHash
- **THEN** 最多同时执行 8 个 pHash 计算任务

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

流水线 SHALL 在 Processing 和 Analyzing 阶段的每次迭代中检查 `cancel_flag`。取消后停止后续处理，将已完成的结果更新到 `SessionState`，状态变为 Cancelled。

#### Scenario: 处理阶段取消

- **WHEN** 在 Processing 阶段触发取消
- **THEN** 停止启动新的 NEF 处理任务，等待已启动的任务完成，返回已处理的部分结果

#### Scenario: 分析阶段取消

- **WHEN** 在 Analyzing 阶段触发取消
- **THEN** 停止后续 pHash 计算，跳过分组阶段，返回已有的处理结果
