## Purpose

reclassify IPC 命令能力：支持用户选择省份后重新执行鸟种分类，将省份坐标作为无 EXIF GPS 照片的地理过滤 fallback。

## Requirements

### Requirement: reclassify IPC 命令
系统 SHALL 提供 `reclassify` Tauri IPC 命令，接收 `lat: f64` 和 `lng: f64` 参数，对当前会话中的照片重新执行鸟种分类。当 lat=0.0 且 lng=0.0 时，SHALL 表示不应用地理过滤。

#### Scenario: 正常重分类
- **WHEN** 前端调用 `reclassify(39.9, 116.4)`
- **THEN** 系统 SHALL 从 SessionState 的 detection_cache 读取检测结果，使用 (39.9, 116.4) 作为 GPS 坐标重跑 `classify_detections` 和 `classify_group_with_fusion`，流式 emit `focus-score-update` 事件更新前端

#### Scenario: 无地理过滤
- **WHEN** 前端调用 `reclassify(0.0, 0.0)`
- **THEN** 系统 SHALL 重跑分类，所有照片的 GPS 参数为 None（不应用地理过滤）

#### Scenario: GPS 优先级
- **WHEN** 某张照片在 metadata_cache 中有 EXIF GPS 坐标
- **THEN** reclassify SHALL 使用该照片的 EXIF GPS 坐标进行分类，而非用户选择的省份坐标

#### Scenario: 省份坐标作为 fallback
- **WHEN** 某张照片在 metadata_cache 中无 EXIF GPS 坐标，且用户选定了省份
- **THEN** reclassify SHALL 使用用户选定的省份坐标作为该照片的 GPS 进行分类

#### Scenario: detection_cache 为空
- **WHEN** SessionState 的 detection_cache 为空（尚未完成 FocusScoring）
- **THEN** reclassify SHALL 返回错误提示"尚未完成鸟类检测，无法重新分类"

### Requirement: reclassify 进度反馈
reclassify 命令执行期间 SHALL 通过 `processing-progress` 事件发送进度信息，processing_state 为 `FocusScoring`。

#### Scenario: 进度事件
- **WHEN** reclassify 正在处理第 50/1000 张照片
- **THEN** SHALL emit `processing-progress` 事件，current=50, total=1000, state=FocusScoring

#### Scenario: 完成事件
- **WHEN** reclassify 处理完所有照片
- **THEN** SHALL emit 最终 `processing-progress` 事件，progressPercent=100

### Requirement: reclassify 写回 detection_cache
reclassify 完成后 SHALL 将新的分类结果（含更新后的 species_name 和 species_confidence）写回 SessionState 的 detection_cache。

#### Scenario: 缓存更新
- **WHEN** reclassify 完成
- **THEN** detection_cache 中对应 hash 的 DetectionBox SHALL 包含更新后的物种分类结果
