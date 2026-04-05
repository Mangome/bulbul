## MODIFIED Requirements

### Requirement: 合焦评分方法选择

系统 SHALL 支持两种合焦评分方法：全画面评分（FullImage，旧方法）和区域评分（BirdRegion，新方法）。当有效检测框时使用区域评分，检测失败时标记为 Undetected 不给评分。

#### Scenario: 成功检测时使用区域评分

- **WHEN** YOLOv8s 检测返回有效框（置信度 >= 0.25）
- **THEN** 仅在检测框内计算 Laplacian 方差，使用 BirdRegion 方法，评分范围 1-5 星

#### Scenario: 检测失败时标记为 Undetected

- **WHEN** YOLOv8s 检测返回空框数组
- **THEN** 不计算合焦评分，设置 focus_score = null，focus_score_method = Undetected

#### Scenario: 向后兼容旧数据

- **WHEN** 查询由旧系统生成的元数据（无 detection_bboxes）
- **THEN** 认为该图片使用 FullImage 方法，focus_score_method = FullImage

### Requirement: 区域 Laplacian 方差计算

区域评分使用同全画面相同的算法，但仅在检测框内执行：灰度转换 → Lanczos3 下采样到长边 512px → Laplacian 卷积 → 在 bbox 区域内分块方差 → Top-3 中位数 → 映射到 1-5 星。

#### Scenario: 在 bbox 内计算方差

- **WHEN** 检测框相对坐标 (0.2, 0.1, 0.8, 0.9)，图片下采样到 512px 后为 (102, 51, 409, 460) 像素
- **THEN** 仅在该像素范围内执行 Laplacian 卷积和分块评估

#### Scenario: 相同的映射阈值

- **WHEN** 计算出 bbox 内的 Laplacian 方差为 1500
- **THEN** 使用现有映射（>= 1200 → 5 星）返回评分 5

### Requirement: 方差映射（现有规则，待重新标定）

系统 SHALL 继续使用现有的方差到星级映射（variance >= 1200 → 5, >= 600 → 4, >= 200 → 3, >= 50 → 2, < 50 → 1），后续基于区域评分的实际分布重新标定。

#### Scenario: 映射规则继承

- **WHEN** 计算出区域 Laplacian 方差为 750
- **THEN** 映射为 4 星（使用现有的 >= 600 规则）

#### Scenario: 标定计划

- **WHEN** 使用 500+ 实际鸟类照片测试区域评分
- **THEN** 重新计算方差分布，调整阈值（计划 1-2 周）

### Requirement: 下采样保持宽高比

合焦评分 SHALL 将输入图片等比缩放到长边 512px，保持宽高比。

#### Scenario: 宽图片下采样

- **WHEN** 输入 800×600 图片
- **THEN** 下采样到 512×384（长边 512）

#### Scenario: 高图片下采样

- **WHEN** 输入 600×800 图片
- **THEN** 下采样到 384×512（长边 512）

### Requirement: 边界处理

Laplacian 卷积不进行零 padding，直接跳过边界 1 像素，输出尺寸为 (w-2) × (h-2)。

#### Scenario: 边界像素跳过

- **WHEN** 下采样图片为 512×384
- **THEN** Laplacian 输出为 510×382，避免边界伪影
