## MODIFIED Requirements

### Requirement: 端到端处理流水线

`process_folder` 命令 SHALL 实现完整的 6 阶段流水线：Scanning（扫描所有支持的 RAW 格式文件）→ Processing（提取 JPEG + Exif + 缩略图）→ Analyzing（计算 pHash + 相似度）→ Grouping（执行分组算法）→ Completed（完成）→ **FocusScoring（后台异步计算合焦评分）**。最终返回 `GroupResult`，FocusScoring 不阻塞返回。

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

#### Scenario: 完整流水线执行

- **WHEN** 调用 `process_folder` 并提供一个包含 NEF 和 CR2 文件的文件夹路径
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

- **WHEN** 提供的文件夹中没有支持的 RAW 格式文件
- **THEN** 返回空的 `GroupResult`（groups 为空，total_images 为 0），状态直接变为 Completed，不执行 FocusScoring

#### Scenario: FocusScoring 后台执行

- **WHEN** 流水线完成到 Completed 阶段并返回 GroupResult
- **THEN** FocusScoring 继续在后台异步执行，不影响主流程

### Requirement: 取消支持

流水线 SHALL 在 Processing 和 Analyzing 阶段的每次迭代中检查 `cancel_flag`。取消后停止后续处理，将已完成的结果更新到 `SessionState`，状态变为 Cancelled。已写入磁盘的缓存文件 SHALL 保留（部分结果仍有价值）。

#### Scenario: 处理阶段取消

- **WHEN** 在 Processing 阶段触发取消
- **THEN** 停止启动新的 RAW 文件处理任务，等待已启动的任务完成，返回已处理的部分结果

#### Scenario: 分析阶段取消

- **WHEN** 在 Analyzing 阶段触发取消
- **THEN** 停止后续 pHash 计算，跳过分组阶段，返回已有的处理结果
