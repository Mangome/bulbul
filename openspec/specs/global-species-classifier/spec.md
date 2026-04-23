## Purpose

全球鸟种分类能力：使用 ResNet34/MetaFGNet ONNX 模型对鸟类检测框裁剪区域进行 10,964 种全球鸟类的物种分类，包括模型推理、预处理、后处理、物种数据库和融合适配。

## Requirements

### Requirement: ResNet34 全球鸟类分类模型推理

系统后端 SHALL 使用 ResNet34/MetaFGNet 量化 ONNX 模型（bird_classifier.onnx）进行鸟种分类，覆盖 10,964 种全球鸟类。模型文件从资源目录加载，缓存在内存中避免重复加载。当提供 GPS 坐标时，SHALL 在 softmax 后应用地理过滤，将不在该地区的物种概率置零并重新归一化。分类时 SHALL 支持 GPS 坐标传入以启用地理过滤，且支持手动 GPS override（省份坐标）作为无 EXIF GPS 照片的 fallback。

#### Scenario: 首次推理加载模型

- **WHEN** 系统首次调用分类函数
- **THEN** 从资源目录加载 bird_classifier.onnx 到 ONNX Runtime Session，缓存在内存

#### Scenario: 后续推理使用缓存

- **WHEN** 系统第二次调用分类函数
- **THEN** 使用内存缓存的 Session，无需重新加载模型文件

#### Scenario: 模型输入格式

- **WHEN** 对裁剪后的鸟图执行分类推理
- **THEN** 输入张量形状为 [1, 3, 224, 224]，数据类型 float32，使用 ImageNet 标准归一化（mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]）

#### Scenario: 模型输出格式

- **WHEN** 分类推理完成
- **THEN** 输出为 [1, 10964] 的原始 logits 向量，需经 softmax 转换为概率分布

#### Scenario: 有 GPS 时应用地理过滤

- **WHEN** 调用 `classify_detections()` 传入 gps=Some((39.9, 116.4))
- **THEN** softmax 后对概率向量应用地理过滤，仅保留北京地区可能出现的约 170 个物种的概率，其余置零后重新归一化

#### Scenario: 无 GPS 时不应用地理过滤

- **WHEN** 调用 `classify_detections()` 传入 gps=None
- **THEN** softmax 后不应用地理过滤，保持 10,964 维全量概率分布

#### Scenario: EXIF GPS 优先使用

- **WHEN** 照片有 EXIF GPS 坐标 (30.5, 114.3)，且用户选定了省份"云南"（25.0, 102.7）
- **THEN** 分类 SHALL 使用 EXIF GPS 坐标 (30.5, 114.3) 进行地理过滤

#### Scenario: 省份坐标作为 fallback

- **WHEN** 照片无 EXIF GPS 坐标，且用户选定了省份"云南"（25.0, 102.7）
- **THEN** 分类 SHALL 使用省份坐标 (25.0, 102.7) 进行地理过滤

#### Scenario: 无 GPS 且无省份选择

- **WHEN** 照片无 EXIF GPS 坐标，且用户未选择省份
- **THEN** 分类 SHALL 不应用地理过滤，所有 10,964 种均可匹配

### Requirement: ImageNet 标准预处理

分类前 SHALL 对输入图片执行 ImageNet 标准预处理：直接 Resize 到 224x224 → RGB 像素值除以 255 → 减去 ImageNet 均值 → 除以 ImageNet 标准差 → HWC 转 CHW 通道排列。

#### Scenario: 非正方形图片 Resize

- **WHEN** 输入裁剪区域为 300x200 像素
- **THEN** 直接 Resize 到 224x224（不保持宽高比），与模型训练时预处理一致

#### Scenario: ImageNet 归一化

- **WHEN** 像素 RGB 值为 (128, 64, 32)
- **THEN** 归一化后 R = (128/255 - 0.485) / 0.229 ≈ 0.073，G = (64/255 - 0.456) / 0.224 ≈ -0.860，B = (32/255 - 0.406) / 0.225 ≈ -1.234

#### Scenario: 通道排列 HWC→CHW

- **WHEN** 预处理完成
- **THEN** 输出张量按 [N, C, H, W] 排列，即 R 通道全部像素 → G 通道全部像素 → B 通道全部像素

### Requirement: Softmax 后处理

分类推理后 SHALL 对原始 logits 执行 softmax 转换为概率分布，再取 argmax 得到最可能的物种类别。

#### Scenario: softmax 转概率

- **WHEN** 模型输出 logits 向量
- **THEN** 对 logits 执行 softmax，概率和为 1.0

#### Scenario: argmax 取最佳类别

- **WHEN** softmax 后概率分布中类别 42 的概率最高（0.65）
- **THEN** 返回 (class_idx=42, confidence=0.65)

### Requirement: 10,964 种全球物种数据库

系统 SHALL 提供 10,964 种鸟类的物种数据库（species_database.json），每个条目包含 class_id、scientific_name、common_name_en、common_name_zh、order、family、genus。

#### Scenario: 物种名称查找

- **WHEN** 分类结果 class_idx=42（0-indexed）
- **THEN** 查找 class_id=43 的数据库条目，返回 display_name（优先中文名，fallback 英文名）

#### Scenario: 中文名称覆盖

- **WHEN** 数据库条目 common_name_zh 非空
- **THEN** display_name 返回中文名

#### Scenario: 中文名称缺失回退

- **WHEN** 数据库条目 common_name_zh 为空或 null
- **THEN** display_name 返回英文名

### Requirement: 调整物种置信度阈值

物种最低置信度阈值 SHALL 从 0.25 调整为 0.10，以适应 10,964 类分类下置信度自然分散的特点。

#### Scenario: 高置信度物种标注

- **WHEN** 分类置信度 ≥ 0.10
- **THEN** 在 DetectionBox 中填充 species_name 和 species_confidence

#### Scenario: 低置信度物种过滤

- **WHEN** 分类置信度 < 0.10
- **THEN** 不标注物种名称，DetectionBox 的 species_name 保持 None

### Requirement: 多帧融合维度适配

分组内多帧概率平均融合 SHALL 适配 10,964 维概率向量，融合逻辑不变（逐元素平均 → argmax）。当提供 GPS 坐标时，SHALL 在融合后对融合概率向量应用地理过滤。

#### Scenario: 融合概率向量维度

- **WHEN** 同组 3 张图片各产生 10,964 维概率向量
- **THEN** 逐元素平均后得到 10,964 维融合概率，argmax 取最终物种

#### Scenario: 融合后地理过滤

- **WHEN** 调用 `classify_group_with_fusion()` 传入 gps=Some((39.9, 116.4))
- **THEN** 融合概率向量在 argmax 前应用地理过滤，再取最终物种

#### Scenario: 融合置信度过滤

- **WHEN** 融合后最高概率 < 0.10
- **THEN** 不标注物种名称

### Requirement: 裁剪区域 padding 保持

分类前裁剪检测框区域时 SHALL 保持向外扩展 25% 的 padding（CROP_PADDING_RATIO），以保留背景上下文信息。

#### Scenario: 正常检测框裁剪

- **WHEN** 检测框像素尺寸 400x300
- **THEN** 向外扩展 100px/75px padding，裁剪区域为 600x450

#### Scenario: 检测框紧贴边界

- **WHEN** 检测框紧贴图片左上角
- **THEN** padding 被 clamp 到图片边界，不超出范围
