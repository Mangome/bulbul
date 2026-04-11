## ADDED Requirements

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
