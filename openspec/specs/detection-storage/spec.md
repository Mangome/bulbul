## Requirements

### Requirement: 检测框持久化存储

系统 SHALL 将检测结果（所有框的坐标和置信度）存储在 `ImageMetadata.detection_bboxes` 数组中，支持长期查询和前端可视化。

#### Scenario: 单框存储

- **WHEN** 检测完成，获得 1 个鸟框，相对坐标 (0.2, 0.1, 0.8, 0.9)，置信度 0.95
- **THEN** 存储为 `{ x1: 0.2, y1: 0.1, x2: 0.8, y2: 0.9, confidence: 0.95 }`

#### Scenario: 多框存储

- **WHEN** 检测完成，获得 3 个鸟框
- **THEN** 存储为包含 3 个元素的数组，按置信度降序排列

#### Scenario: 无框存储

- **WHEN** 检测失败，无框返回
- **THEN** `detection_bboxes` 为空数组 `[]`

### Requirement: 评分方法标记

系统 SHALL 在 `ImageMetadata.focus_score_method` 字段记录本次合焦评分的方法：FullImage（全画面）、BirdRegion（鸟区域）或 Undetected（未检测到）。

#### Scenario: 成功检测标记

- **WHEN** 检测成功，基于检测框计算评分
- **THEN** 设置 `focus_score_method = BirdRegion`

#### Scenario: 检测失败标记

- **WHEN** 检测失败，不计算评分
- **THEN** 设置 `focus_score_method = Undetected`

#### Scenario: 向后兼容旧数据

- **WHEN** 查询由旧系统生成的元数据（无 detection_bboxes）
- **THEN** `focus_score_method` 默认为 FullImage（旧系统使用的方法）

### Requirement: 数据模型定义

系统 SHALL 定义 Rust 结构体（可序列化）：

```rust
#[derive(Serialize, Deserialize, Clone)]
pub struct DetectionBox {
    pub x1: f32,        // 左边界 [0, 1]
    pub y1: f32,        // 上边界 [0, 1]
    pub x2: f32,        // 右边界 [0, 1]
    pub y2: f32,        // 下边界 [0, 1]
    pub confidence: f32, // 置信度 [0, 1]
}

#[derive(Serialize, Deserialize, Clone, PartialEq)]
pub enum FocusScoringMethod {
    FullImage,      // 全画面评分（旧方法）
    BirdRegion,     // 鸟区域评分（新方法）
    Undetected,     // 未检测到主体
}

// ImageMetadata 扩展
pub struct ImageMetadata {
    // ... existing fields ...
    pub detection_bboxes: Vec<DetectionBox>,
    pub focus_score_method: Option<FocusScoringMethod>,
}
```

#### Scenario: 结构体序列化

- **WHEN** 将 `ImageMetadata` 序列化为 JSON
- **THEN** `detection_bboxes` 和 `focus_score_method` 正确序列化，可被前端反序列化

#### Scenario: 向前端传输

- **WHEN** 前端通过 IPC 请求 `get_metadata(hash)`
- **THEN** 返回包含 `detection_bboxes` 和 `focus_score_method` 的完整 `ImageMetadata`

### Requirement: 元数据缓存更新

SessionState 的元数据缓存 SHALL 在合焦评分阶段完成后，同步更新所有图片的 `detection_bboxes` 和 `focus_score_method`。

#### Scenario: 评分后缓存更新

- **WHEN** FocusScoring 阶段为图片完成检测和评分
- **THEN** 更新 `SessionState.metadata_cache[hash]`，包含新的 detection_bboxes 和 focus_score_method

#### Scenario: 缓存持久化

- **WHEN** 用户关闭并重新打开应用
- **THEN** 之前计算的 detection_bboxes 可从缓存恢复（如果启用了持久化缓存）
