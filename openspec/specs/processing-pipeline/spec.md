## Requirements

### Requirement: 端到端处理流水线

`process_folder` 命令 SHALL 实现完整的 5 阶段流水线：Scanning（扫描 NEF 文件）→ Processing（提取 JPEG + Exif + 缩略图）→ Analyzing（计算 pHash + 相似度）→ Grouping（执行分组算法）→ Completed（完成）。最终返回 `GroupResult`。

#### Scenario: 完整流水线执行

- **WHEN** 调用 `process_folder` 并提供一个包含 NEF 文件的文件夹路径
- **THEN** 依次经过 Scanning → Processing → Analyzing → Grouping → Completed 五个阶段，返回包含分组数据和性能指标的 `GroupResult`

#### Scenario: 空文件夹

- **WHEN** 提供的文件夹中没有 NEF 文件
- **THEN** 返回空的 `GroupResult`（groups 为空，total_images 为 0），状态直接变为 Completed

### Requirement: 分阶段进度事件推送

流水线 SHALL 在每个阶段推送 `processing-progress` 事件，事件 payload 为 `ProcessingProgress`，包含当前阶段（state）、当前进度（current/total）、进度百分比、当前处理文件名、已用时间、预估剩余时间。

#### Scenario: Processing 阶段进度

- **WHEN** NEF 处理阶段完成一个文件
- **THEN** emit 事件，`state` 为 `Processing`，`current` 递增 1

#### Scenario: Analyzing 阶段进度

- **WHEN** pHash 计算完成一张图片
- **THEN** emit 事件，`state` 为 `Analyzing`，`current` 递增 1

#### Scenario: 计时信息

- **WHEN** 任何进度事件被推送
- **THEN** `elapsed_ms` 为从流水线开始到当前时刻的耗时（毫秒），`estimated_remaining_ms` 为基于当前速率的估算值

### Requirement: 取消支持

流水线 SHALL 在 Processing 和 Analyzing 阶段的每次迭代中检查 `cancel_flag`。取消后停止后续处理，将已完成的结果更新到 `SessionState`，状态变为 Cancelled。

#### Scenario: 处理阶段取消

- **WHEN** 在 Processing 阶段触发取消
- **THEN** 停止启动新的 NEF 处理任务，等待已启动的任务完成，返回已处理的部分结果

#### Scenario: 分析阶段取消

- **WHEN** 在 Analyzing 阶段触发取消
- **THEN** 停止后续 pHash 计算，跳过分组阶段，返回已有的处理结果

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
