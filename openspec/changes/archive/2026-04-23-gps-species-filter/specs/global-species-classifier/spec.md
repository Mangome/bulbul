## MODIFIED Requirements

### Requirement: ResNet34 全球鸟类分类模型推理

系统后端 SHALL 使用 ResNet34/MetaFGNet 量化 ONNX 模型（bird_classifier.onnx）进行鸟种分类，覆盖 10,964 种全球鸟类。模型文件从资源目录加载，缓存在内存中避免重复加载。当提供 GPS 坐标时，SHALL 在 softmax 后应用地理过滤，将不在该地区的物种概率置零并重新归一化。

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
