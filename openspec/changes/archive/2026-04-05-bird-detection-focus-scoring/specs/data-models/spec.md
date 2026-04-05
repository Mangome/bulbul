## MODIFIED Requirements

### Requirement: ImageMetadata 扩展

`ImageMetadata` 结构 SHALL 新增两个字段：`detection_bboxes`（检测框数组）和 `focus_score_method`（评分方法标记）。两个字段均为 Option 类型，支持向后兼容。

#### Scenario: 新增 detection_bboxes 字段

- **WHEN** 图片完成检测
- **THEN** `detection_bboxes` 包含所有检测到的框数组（相对坐标、置信度）

#### Scenario: 新增 focus_score_method 字段

- **WHEN** 图片完成评分
- **THEN** `focus_score_method` 为 Some(BirdRegion | FullImage | Undetected)

#### Scenario: 向后兼容旧数据

- **WHEN** 读取由旧系统生成的元数据（无这两个字段）
- **THEN** `detection_bboxes` 默认为空数组，`focus_score_method` 默认为 Some(FullImage)

### Requirement: ProcessingState 扩展

`ProcessingState` 枚举 SHALL 新增 `FocusScoring` 变体，表示后台合焦评分阶段。

#### Scenario: FocusScoring 状态

- **WHEN** 流水线完成 Completed 后启动后台 FocusScoring
- **THEN** 内部状态包含 FocusScoring，虽然对外返回的 GroupResult state 仍为 Completed

#### Scenario: 状态转移

- **WHEN** 从 Grouping 完成到 Completed
- **THEN** 随后进入 FocusScoring（不影响 Completed 返回）

### Requirement: DetectionBox 结构体定义

系统 SHALL 定义 `DetectionBox` 结构体（可序列化）包含坐标和置信度：

```rust
#[derive(Serialize, Deserialize, Clone)]
pub struct DetectionBox {
    pub x1: f32,        // 左边界，范围 [0, 1]
    pub y1: f32,        // 上边界，范围 [0, 1]
    pub x2: f32,        // 右边界，范围 [0, 1]
    pub y2: f32,        // 下边界，范围 [0, 1]
    pub confidence: f32, // 置信度，范围 [0, 1]
}
```

#### Scenario: 坐标范围验证

- **WHEN** 创建 DetectionBox
- **THEN** 坐标值必须在 [0, 1] 范围内（规范化坐标）

#### Scenario: JSON 序列化

- **WHEN** 将 DetectionBox 序列化为 JSON
- **THEN** 输出为 `{ "x1": 0.2, "y1": 0.1, "x2": 0.8, "y2": 0.9, "confidence": 0.95 }`

### Requirement: FocusScoringMethod 枚举定义

系统 SHALL 定义 `FocusScoringMethod` 枚举（可序列化，支持比较）：

```rust
#[derive(Serialize, Deserialize, Clone, PartialEq)]
pub enum FocusScoringMethod {
    FullImage,      // 全画面评分（旧方法）
    BirdRegion,     // 鸟区域评分（新方法）
    Undetected,     // 未检测到主体，不给评分
}
```

#### Scenario: 枚举值使用

- **WHEN** 在代码中进行模式匹配
- **THEN** `match focus_score_method { FocusScoringMethod::BirdRegion => ..., ... }`

#### Scenario: JSON 序列化

- **WHEN** 将 FocusScoringMethod 序列化为 JSON
- **THEN** 输出为字符串 `"BirdRegion"` / `"FullImage"` / `"Undetected"`

### Requirement: TypeScript 类型对应

前端 TypeScript 类型 `types/index.ts` SHALL 定义对应的接口：

```typescript
interface DetectionBox {
  x1: number;        // [0, 1]
  y1: number;        // [0, 1]
  x2: number;        // [0, 1]
  y2: number;        // [0, 1]
  confidence: number; // [0, 1]
}

type FocusScoringMethod = "FullImage" | "BirdRegion" | "Undetected";

interface ImageMetadata {
  // ... existing fields ...
  detectionBboxes: DetectionBox[];
  focusScoringMethod?: FocusScoringMethod;
}
```

#### Scenario: 前后端类型一致

- **WHEN** 前端从后端获取 ImageMetadata JSON
- **THEN** TypeScript 自动反序列化为 ImageMetadata 接口，无类型错误

#### Scenario: camelCase 转换

- **WHEN** Rust 发送 `detection_bboxes`、`focus_score_method`
- **THEN** serde rename_all 自动转换为 `detectionBboxes`、`focusScoringMethod`（前端 camelCase）
