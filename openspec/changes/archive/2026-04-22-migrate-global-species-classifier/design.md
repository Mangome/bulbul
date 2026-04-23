## Context

bulbul 当前的鸟种分类模块 (`bird_classification.rs`) 使用 YOLOv8s-cls 模型，仅覆盖 373 种中国鸟类。模型预处理的流程为：Resize 短边到 224 → CenterCrop 224×224 → 归一化到 [0, 1] → NCHW 排列，输出已经是 softmax 概率。

osea_mobile 项目拥有一个基于 ResNet34/MetaFGNet 框架的全球鸟类分类模型（10,964 种），使用 DongNiao DIB-10K 数据集训练，量化后仅 4.2MB。其预处理为 ImageNet 标准流程：Resize 224×224 → mean/std 归一化 → HWC→CHW，输出为原始 logits（需手动 softmax）。

两个项目均使用 ONNX Runtime 推理，bulbul 的 Rust `ort` crate 可直接加载 osea_mobile 的 ONNX 模型。

## Goals / Non-Goals

**Goals:**
- 将分类模型从 373 种中国鸟类替换为 10,964 种全球鸟类
- 保持现有后端管线架构不变（检测→分类→合焦评分→多帧融合）
- 保持 DetectionBox 数据结构和前端渲染逻辑不变
- 模型体积不增大（4.2MB 量化模型 ≤ 当前模型体积）
- 保持或提升单帧推理性能

**Non-Goals:**
- 不实现地理分布过滤（GPS 过滤可作为后续增强）
- 不修改鸟类检测模型（bird_detector.onnx 保持不变）
- 不修改前端代码
- 不实现双模型共存或回退机制

## Decisions

### Decision 1: 直接替换模型而非双模型共存

**选择**：单模型替换，将 YOLOv8s-cls 替换为 ResNet34/MetaFGNet

**替代方案**：双模型共存（373 类中国优先 + 10,964 类全球兜底）

**理由**：
- 双模型增加内存占用和推理延迟，用户体验下降
- ResNet34 量化模型仅 4.2MB，远小于 YOLOv8s-cls，内存压力反而降低
- 10,964 类模型已包含 373 类中国鸟种中的绝大多数，精度损失可控
- 单模型架构简单，维护成本低

### Decision 2: 物种数据库格式兼容

**选择**：沿用现有 `species_database.json` 格式，扩展 `SpeciesEntry` 的 `common_name_zh` 为必需字段

**替代方案**：改用 bird_info.json 的简单数组格式 [中文名, 英文名, 学名]

**理由**：
- 现有 `SpeciesEntry` 结构包含目/科/属分类学信息，对后续功能有价值
- 保持 `SpeciesEntry` 和 `display_name()` 逻辑不变，减少代码修改
- bird_info.json 缺少目/科/属信息，需额外数据源补充（可留空）

### Decision 3: 预处理适配 ImageNet 标准

**选择**：将预处理改为 ImageNet 标准流程（直接 Resize 224×224 + mean/std 归一化）

**理由**：
- 这是 ResNet34/MetaFGNet 模型训练时的预处理方式，必须匹配
- 直接 Resize 比 Resize+CenterCrop 简单，代码更清晰
- ImageNet mean/std 归一化是 CV 领域标准做法

### Decision 4: softmax 在 Rust 端执行

**选择**：在 `classify_crop_with_probs()` 内部添加 softmax，对外接口不变

**理由**：
- 现有代码已有一个 `softmax()` 函数（标记 `#[allow(dead_code)]`），直接启用
- `classify_group_with_fusion()` 需要概率向量做逐元素平均，softmax 必须在融合前执行
- 对外接口 `(probs, best_idx, best_conf)` 保持不变，融合逻辑无需修改

### Decision 5: 置信度阈值调整

**选择**：将 `SPECIES_CONFIDENCE_THRESHOLD` 从 0.25 降低到 0.10

**理由**：
- 10,964 类分类下，Top-1 置信度天然分散（类似别的概率被摊薄）
- osea_mobile 使用 0.01 作为最低过滤阈值，0.10 是合理的中等阈值
- 过高的阈值会导致大量正确识别被过滤，失去分类价值
- 具体数值需要实测后校准

## Risks / Trade-offs

- **[精度风险] 中国特有鸟种识别精度可能下降** → ResNet34 在 DIB-10K 上训练，373 种中国鸟种可能不如专精模型精准。缓解：实测对比，若关键鸟种精度下降显著，可考虑后续微调或双模型回退

- **[分类学信息缺失] bird_info.json 无目/科/属** → 物种数据库中 order/family/genus 字段留空。缓解：后续可从 eBird/Clements 分类学数据源补充

- **[置信度校准不确定] 10,964 类下的置信度分布未知** → 初始阈值 0.10 可能偏高或偏低。缓解：实施后用实际 RAW 图片测试，根据 Top-1/Top-3 准确率调整

- **[预处理差异导致精度偏差] Resize 方式不同（直接 Resize vs Resize+CenterCrop）** → 直接 Resize 会略微拉伸非正方形图片，但这是模型训练时使用的预处理方式，必须匹配。不会引入偏差

- **[模型兼容性] ONNX 算子集兼容性未知** → ResNet34/MetaFGNet 使用标准卷积+BN+ReLU+Gemm 算子，ort crate 完全支持。风险极低
