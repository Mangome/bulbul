## Why

当前合焦评级算法基于全画面 Laplacian 二阶梯度方差（5×4 分块 Top-3 中位数），无法准确反映鸟类摄影中"鸟有没有拍清楚"的实际情况。在浅景深拍摄中，背景完全失焦但被评估为高锐度；复杂背景中，失焦的鸟反而因背景纹理被评为"清晰"。引入 YOLOv8s 目标检测，仅评估检测框内（鸟的主体区域）的锐度，可显著提升鸟类摄影场景下的评分准确度。

## What Changes

- 后端引入 ONNX Runtime (`ort` crate)，集成 YOLOv8s 预训练模型（COCO bird 类别）
- 处理流水线 Analyzing 阶段之后新增 **FocusScoring** 阶段，串行执行鸟类检测 → 区域合焦评分
- 扩展 `ImageMetadata` 结构，新增 `detection_bboxes` 字段存储所有检测框（相对坐标），`focus_score_method` 记录评分方法（full-image / bird-region / undetected）
- 合焦评分失败场景改为标记为"未检测到主体"而非给出全画面评分
- 前端新增 Detection Overlay 组件，用户 hover 评分组件时在预览图上绘制检测框
- YOLOv8s 模型文件（~22MB）打包进安装包，接受分发体积增加

## Capabilities

### New Capabilities

- `bird-detection`: YOLOv8s 目标检测推理模块，支持 letterbox 等比缩放、NMS 过滤、置信度阈值（0.25）、多框处理
- `focus-scoring-by-region`: 基于检测框区域的合焦评分计算，Laplacian 方差仅在 bbox 内计算，支持检测失败降级
- `detection-storage`: 在 ImageMetadata 中持久化存储检测结果（bboxes + 评分方法标记）
- `detection-overlay-ui`: React 组件，hover 时在 Pixi 画布上绘制检测框标注

### Modified Capabilities

- `processing-pipeline`: 在 Analyzing 后新增 **FocusScoring** 阶段（后台异步，不阻塞返回），进度事件包含 `focus-score-update` 事件
- `focus-score`: 改造现有合焦评分逻辑，支持全画面 vs 区域评分两种模式，检测失败时标记而非降级评分
- `data-models`: 扩展 `ImageMetadata` 和 `ProcessingState` 枚举

## Impact

- **后端依赖**：新增 `ort` crate（ONNX Runtime Rust binding）
- **安装包体积**：增加 ~26MB（ONNX 动态库 ~20MB + 模型文件 ~22MB YOLOv8s）
- **性能**：单张推理 50-150ms（CPU，现代硬件），后台异步执行，不阻塞主流程
- **TypeScript 类型**：更新 `ImageMetadata` 和 `ProcessingState` 类型定义
- **IPC 接口**：新增 `focus-score-update` 事件（hash, score, method）
- **相机兼容性**：与相机品牌无关，通用方案
