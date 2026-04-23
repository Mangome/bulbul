## Why

当前 bulbul 的鸟种分类模型仅覆盖 373 种中国鸟类，而中国有记录的鸟种约 1,400-1,500 种，全球超过 10,000 种。覆盖率不足导致约 75% 的国内鸟种和全部海外鸟种无法识别，严重限制了应用的实用性。osea_mobile 项目已有一个基于 ResNet34/MetaFGNet 的 10,964 种全球鸟类分类模型（4.2MB 量化 ONNX），可直接移植到 bulbul 的 Rust 后端，将物种覆盖率提升约 30 倍。

## What Changes

- **替换分类模型**：将 YOLOv8s-cls (373类) 替换为 ResNet34/MetaFGNet (10,964类)，模型文件从 osea_mobile 的 `bird_model.onnx` (4.2MB) 移植
- **修改预处理逻辑**：从 YOLOv8s-cls 预处理（Resize短边+CenterCrop+[0,1]归一化）改为 ImageNet 标准预处理（直接 Resize 224×224+mean/std 归一化+HWC→CHW）
- **启用 softmax 后处理**：新模型输出原始 logits，需在推理后执行 softmax 转概率
- **重建物种数据库**：从 `bird_info.json` (10,964条) 转换为 bulbul 的 `species_database.json` 格式，补充分类学信息
- **调整置信度阈值**：10,964 类下置信度分布更分散，需重新校准 `SPECIES_CONFIDENCE_THRESHOLD`
- **更新多帧融合维度**：`classify_group_with_fusion()` 的概率向量维度从 373 → 10,964

## Capabilities

### New Capabilities
- `global-species-classifier`: 全球 10,964 种鸟类分类能力，包含模型预处理、推理、softmax 后处理、物种数据库查询

### Modified Capabilities
- `bird-detection`: 检测模型不变，但分类阶段对接新的全球物种分类器，DetectionBox 的 species_name 和 species_confidence 含义不变，覆盖范围从 373 种扩展到 10,964 种

## Impact

- **Rust 后端**：`bird_classification.rs` 预处理和后处理逻辑重写，模型文件替换，物种数据库重建
- **模型资源**：`bird_classifier.onnx` 替换为新的 `bird_model.onnx`（体积从当前大小降至 4.2MB），`species_database.json` 从 373 条扩展到 10,964 条
- **前端**：无代码变更，DetectionBox 数据结构不变，检测框覆盖层渲染逻辑兼容
- **训练脚本**：`temp/train_classifier_cn.py` 和 `temp/export_classifier_onnx_cn.py` 归档为 legacy
- **性能**：ResNet34 量化模型比 YOLOv8s-cls 更轻量，预期单帧推理速度持平或更快
- **测试**：需更新 `bird_classification.rs` 中的单元测试（预处理形状、归一化值、softmax 行为等）
