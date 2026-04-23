## ADDED Requirements

### Requirement: ResNet34 全球鸟类分类模型推理

系统后端 SHALL 使用 ResNet34/MetaFGNet 量化 ONNX 模型（bird_model.onnx, 4.2MB）进行鸟种分类，覆盖 10,964 种全球鸟类。模型文件从资源目录加载，缓存在内存中避免重复加载。

#### Scenario: 首次推理加载模型

- **WHEN** 系统首次调用分类函数
- **THEN** 从资源目录加载 bird_model.onnx 到 ONNX Runtime Session，缓存在内存

#### Scenario: 后续推理使用缓存

- **WHEN** 系统第二次调用分类函数
- **THEN** 使用内存缓存的 Session，无需重新加载模型文件

#### Scenario: 模型输入格式

- **WHEN** 对裁剪后的鸟图执行分类推理
- **THEN** 输入张量形状为 [1, 3, 224, 224]，数据类型 float32，使用 ImageNet 标准归一化（mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]）

#### Scenario: 模型输出格式

- **WHEN** 分类推理完成
- **THEN** 输出为 [1, 10964] 的原始 logits 向量，需经 softmax 转换为概率分布

### Requirement: ImageNet 标准预处理

分类前 SHALL 对输入图片执行 ImageNet 标准预处理：直接 Resize 到 224×224 → RGB 像素值除以 255 → 减去 ImageNet 均值 → 除以 ImageNet 标准差 → HWC 转 CHW 通道排列。

#### Scenario: 非正方形图片 Resize

- **WHEN** 输入裁剪区域为 300×200 像素
- **THEN** 直接 Resize 到 224×224（不保持宽高比），与模型训练时预处理一致

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

分组内多帧概率平均融合 SHALL 适配 10,964 维概率向量，融合逻辑不变（逐元素平均 → argmax）。

#### Scenario: 融合概率向量维度

- **WHEN** 同组 3 张图片各产生 10,964 维概率向量
- **THEN** 逐元素平均后得到 10,964 维融合概率，argmax 取最终物种

#### Scenario: 融合置信度过滤

- **WHEN** 融合后最高概率 < 0.10
- **THEN** 不标注物种名称

### Requirement: 裁剪区域 padding 保持

分类前裁剪检测框区域时 SHALL 保持向外扩展 25% 的 padding（CROP_PADDING_RATIO），以保留背景上下文信息。

#### Scenario: 正常检测框裁剪

- **WHEN** 检测框像素尺寸 400×300
- **THEN** 向外扩展 100px/75px padding，裁剪区域为 600×450

#### Scenario: 检测框紧贴边界

- **WHEN** 检测框紧贴图片左上角
- **THEN** padding 被 clamp 到图片边界，不超出范围

## MODIFIED Requirements

### Requirement: 对检测到的鸟类区域执行物种分类

系统后端 SHALL 在鸟类检测完成后，对每个检测框裁剪区域执行全球鸟种分类，填充 DetectionBox 的 species_name 和 species_confidence。分类模型为 ResNet34/MetaFGNet (10,964类)，置信度阈值 0.10。

#### Scenario: 单只鸟分类成功

- **WHEN** 检测到一只鸟且分类置信度 ≥ 0.10
- **THEN** DetectionBox 的 species_name 为物种中文名或英文名，species_confidence 为 softmax 后的概率

#### Scenario: 分类置信度过低

- **WHEN** 分类置信度 < 0.10
- **THEN** DetectionBox 的 species_name 保持 None，不标注物种

#### Scenario: 多只鸟分别分类

- **WHEN** 检测到 3 只鸟
- **THEN** 对每个检测框独立裁剪和分类，各自得到 species_name 和 species_confidence

#### Scenario: 分类失败不影响主流程

- **WHEN** 分类过程中出现任何错误（模型加载失败、图片无法读取等）
- **THEN** 仅记录 warn 日志，不阻断检测和合焦评分流程
