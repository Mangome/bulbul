## Requirements

### Requirement: 时间 + 相似度双条件分组

系统 SHALL 实现 `group_images` 函数，对已按 `(capture_time, filename)` 排序的图片列表执行分组。分组条件：两张图片的拍摄时间间隔 ≤ `time_gap_seconds`（默认 10 秒）**且** 相似度 ≥ `similarity_threshold`（默认 90.0%）时归入同一组。

#### Scenario: 连续相似图片归为一组

- **WHEN** 三张图片拍摄时间间隔均 ≤ 10 秒且两两相似度 ≥ 90%
- **THEN** 三张图片归入同一分组

#### Scenario: 时间断裂导致分组

- **WHEN** 两张相似图片的拍摄时间间隔 > 10 秒
- **THEN** 分到不同分组

#### Scenario: 相似度不足导致分组

- **WHEN** 两张时间间隔 ≤ 10 秒的图片相似度 < 90%
- **THEN** 分到不同分组

#### Scenario: 单张图片自成一组

- **WHEN** 一张图片与前后图片都不满足分组条件
- **THEN** 该图片单独形成一个分组

### Requirement: 顺序扫描 + 早期终止

分组算法 SHALL 使用顺序扫描策略：对每张未分组的图片，向后顺序扫描后续图片，遇到第一个不满足分组条件的图片即终止扫描（break），不再检查更远的图片。

#### Scenario: 早期终止

- **WHEN** 图片 A 与图片 B 不满足分组条件
- **THEN** 不再检查图片 A 与图片 C（C 在 B 之后）的分组关系

#### Scenario: 所有图片均相似

- **WHEN** 所有图片两两满足分组条件
- **THEN** 所有图片归入同一分组

### Requirement: 分组输出格式

`group_images` 函数 SHALL 返回 `Vec<GroupData>`，每个 `GroupData` 包含分组 ID（从 0 递增）、分组名称（`"分组 {id+1}"`）、图片数量、组内平均相似度、代表图 hash（首张图片的 hash）、以及所有图片的 hash/名称/路径列表。

#### Scenario: 分组数据完整性

- **WHEN** 分组完成
- **THEN** 每个 `GroupData` 的 `image_count` 等于 `picture_hashes.len()`，且 `picture_hashes`、`picture_names`、`picture_paths` 三个列表长度一致

#### Scenario: 组内平均相似度计算

- **WHEN** 一个分组包含 3 张图片
- **THEN** `avg_similarity` 为该组所有相邻图片对相似度的平均值

### Requirement: 空输入处理

系统 SHALL 正确处理空图片列表输入。

#### Scenario: 空列表

- **WHEN** 输入空的图片列表
- **THEN** 返回空的 `Vec<GroupData>`

### Requirement: 无时间信息降级

当图片缺少拍摄时间信息时，系统 SHALL 仅使用相似度条件进行分组判断（跳过时间检查）。

#### Scenario: 缺少拍摄时间

- **WHEN** 图片没有 `capture_time`
- **THEN** 仅基于相似度阈值判断是否同组

### Requirement: regroup IPC 命令
系统 SHALL 提供 `regroup` Tauri IPC 命令，接受 `similarity_threshold: f64` 和 `time_gap_seconds: u64` 参数。该命令 SHALL 从 SessionState 的 `image_infos` 缓存读取已排序的图片数据，调用 `group_images_with_phash` 执行分组，更新 SessionState 的 `group_result`，并返回新的 `GroupResult`。

#### Scenario: 正常重分组
- **WHEN** 调用 `regroup(similarity_threshold=80.0, time_gap_seconds=30)` 且 SessionState 中有 image_infos 缓存
- **THEN** SHALL 使用指定阈值重新分组，返回新的 GroupResult，并更新 SessionState.group_result

#### Scenario: 无缓存数据时调用 regroup
- **WHEN** 调用 `regroup` 但 SessionState 中 image_infos 为 None（未处理过文件夹）
- **THEN** SHALL 返回错误信息，提示需要先处理文件夹

#### Scenario: regroup 保留 SessionState 其他数据
- **WHEN** regroup 成功执行
- **THEN** 仅 `group_result` SHALL 被更新，其余字段（phash_cache、metadata_cache、hash maps 等）SHALL 保持不变
