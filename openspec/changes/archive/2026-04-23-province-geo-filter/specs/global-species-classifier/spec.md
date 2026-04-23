## MODIFIED Requirements

### Requirement: ResNet34 全球鸟类分类模型推理

系统后端 SHALL 使用 ResNet34/MetaFGNet 量化 ONNX 模型（bird_model.onnx, 4.2MB）进行鸟种分类，覆盖 10,964 种全球鸟类。模型文件从资源目录加载，缓存在内存中避免重复加载。分类时 SHALL 支持 GPS 坐标传入以启用地理过滤，且支持手动 GPS override（省份坐标）作为无 EXIF GPS 照片的 fallback。

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

#### Scenario: EXIF GPS 优先使用

- **WHEN** 照片有 EXIF GPS 坐标 (30.5, 114.3)，且用户选定了省份"云南"（25.0, 102.7）
- **THEN** 分类 SHALL 使用 EXIF GPS 坐标 (30.5, 114.3) 进行地理过滤

#### Scenario: 省份坐标作为 fallback

- **WHEN** 照片无 EXIF GPS 坐标，且用户选定了省份"云南"（25.0, 102.7）
- **THEN** 分类 SHALL 使用省份坐标 (25.0, 102.7) 进行地理过滤

#### Scenario: 无 GPS 且无省份选择

- **WHEN** 照片无 EXIF GPS 坐标，且用户未选择省份
- **THEN** 分类 SHALL 不应用地理过滤，所有 10,964 种均可匹配
