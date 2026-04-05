## Requirements

### Requirement: YOLOv8s 推理和检测

系统后端 SHALL 集成 ONNX Runtime 和 YOLOv8s 预训练模型，提供鸟类目标检测功能。输入为图片路径，输出为检测框数组（相对坐标 [0, 1]、类别、置信度）。

#### Scenario: 单只鸟检测

- **WHEN** 调用检测函数，输入包含一只鸟的图片路径
- **THEN** 系统返回一个检测框，坐标范围正确（0-1 之间），置信度 > 0.25

#### Scenario: 多只鸟检测

- **WHEN** 调用检测函数，输入包含多只鸟的图片路径
- **THEN** 系统返回多个检测框，按置信度降序排列，置信度 > 0.25

#### Scenario: 无鸟检测

- **WHEN** 调用检测函数，输入纯背景图片（无鸟）
- **THEN** 系统返回空框数组

#### Scenario: 远景小鸟检测

- **WHEN** 输入包含远景小体型鸟的图片（占画面 < 5%）
- **THEN** 系统可能无法检测（取决于 YOLOv8s 精度限制），返回空或低置信度框

### Requirement: Letterbox 等比缩放

检测前 SHALL 将输入图片等比缩放到 640×640，使用 letterbox 方式（上下左右 padding，保持宽高比）。

#### Scenario: 宽图片缩放

- **WHEN** 输入 800×600 图片
- **THEN** 缩放到 640×480（长边 640），上下各 padding 80 像素变成 640×640

#### Scenario: 高图片缩放

- **WHEN** 输入 600×800 图片
- **THEN** 缩放到 480×640（长边 640），左右各 padding 80 像素变成 640×640

#### Scenario: 正方形不变

- **WHEN** 输入 640×640 图片
- **WHEN** 不需要缩放，直接输入推理

### Requirement: NMS 非极大值抑制

检测后 SHALL 使用 NMS（IoU 阈值 0.45）过滤重叠框，移除置信度较低的重复检测。

#### Scenario: 重叠框合并

- **WHEN** 检测到两个高度重叠（IoU > 0.45）的鸟框，置信度分别为 0.8 和 0.6
- **THEN** 移除置信度 0.6 的框，保留 0.8 的框

#### Scenario: 独立框保留

- **WHEN** 检测到两个不重叠（IoU < 0.45）的鸟框
- **THEN** 都保留，不进行合并

### Requirement: 置信度过滤

检测输出 SHALL 过滤掉置信度 < 0.25 的框，仅返回置信度 ≥ 0.25 的框。

#### Scenario: 高置信度框保留

- **WHEN** 检测到置信度 0.75 的鸟框
- **THEN** 包含在返回结果中

#### Scenario: 低置信度框移除

- **WHEN** 检测到置信度 0.15 的框
- **THEN** 不包含在返回结果中

### Requirement: 坐标转换和反归一化

检测框坐标从 YOLOv8s 输出（0-640 像素）反归一化回原始图片尺度，转换为相对坐标（0-1 范围）。

#### Scenario: 坐标反归一化

- **WHEN** YOLOv8s 输出 bbox (100, 100, 200, 200)，lettterbox padding 后原始图片 800×600
- **THEN** 转换为相对坐标，考虑 padding 信息（如适用）

#### Scenario: 归一化到 0-1

- **WHEN** 原始图片 800×600，检测框像素坐标 (100, 50, 200, 150)
- **THEN** 转换为相对坐标 (0.125, 0.083, 0.25, 0.25)

### Requirement: 模型文件管理

系统 SHALL 在编译时将 yolov8s.onnx 模型文件（~22MB）打包进安装包。运行时从资源目录加载，缓存到内存避免重复加载。

#### Scenario: 首次推理加载模型

- **WHEN** 系统首次调用检测函数
- **THEN** 从资源目录加载 yolov8s.onnx 到 ONNX Runtime Session，缓存在内存

#### Scenario: 后续推理使用缓存

- **WHEN** 系统第二次调用检测函数
- **THEN** 使用内存缓存的 Session，无需重新加载模型文件

### Requirement: 推理性能目标

单张 medium JPEG（~512px 长边）的 YOLOv8s 推理耗时 SHALL 控制在 50-150ms（现代 CPU）。

#### Scenario: 快速推理

- **WHEN** 在 Intel i7/AMD Ryzen 7 上进行推理
- **THEN** 推理耗时 50-150ms

#### Scenario: 低端硬件容限

- **WHEN** 在较旧 CPU 上进行推理
- **THEN** 推理耗时可能达 200-300ms，但保持实用性（后台异步，不阻塞 UI）
