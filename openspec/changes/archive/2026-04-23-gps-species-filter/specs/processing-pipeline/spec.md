## MODIFIED Requirements

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
