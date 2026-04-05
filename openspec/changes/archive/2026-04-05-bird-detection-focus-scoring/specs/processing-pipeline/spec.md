## MODIFIED Requirements

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
