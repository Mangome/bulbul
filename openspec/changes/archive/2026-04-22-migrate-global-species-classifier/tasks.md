## 1. 数据准备

- [x] 1.1 编写 Python 脚本将 osea_mobile 的 `bird_info.json` (10,964条) 转换为 bulbul 的 `species_database.json` 格式（class_id, scientific_name, common_name_en, common_name_zh, order, family, genus），order/family/genus 暂留空
- [x] 1.2 从 osea 的 `.pth` 权重导出 FP32 ONNX 模型到 `src-tauri/resources/models/bird_classifier.onnx`（原始量化 ONNX 无法被 Rust ort crate 加载，改用 FP32 ~103MB）

## 2. 预处理逻辑重写

- [x] 2.1 修改 `bird_classification.rs` 中的 `image_to_classifier_input()` 函数：从 Resize短边+CenterCrop+[0,1]归一化 改为 直接 Resize 224×224 + ImageNet mean/std 归一化 + HWC→CHW 通道排列
- [x] 2.2 更新 `image_to_classifier_input()` 的单元测试：验证新预处理输出的张量形状 [1, 3, 224, 224] 和 ImageNet 归一化值的正确性

## 3. 推理后处理修改

- [x] 3.1 启用 `bird_classification.rs` 中被 `#[allow(dead_code)]` 标记的 `softmax()` 函数
- [x] 3.2 修改 `classify_crop_with_probs()` 函数：在获取 ONNX 输出后添加 softmax 调用，将 logits 转为概率
- [x] 3.3 将 `SPECIES_CONFIDENCE_THRESHOLD` 从 0.25 调整为 0.10

## 4. 多帧融合适配

- [x] 4.1 确认 `classify_group_with_fusion()` 的概率向量维度自动从模型输出获取（无需硬编码 373），验证 10,964 维概率向量融合逻辑正确

## 5. 模型路径和数据库更新

- [x] 5.1 确认 `bird_classifier.onnx` 模型路径解析逻辑（`get_classifier_paths()`）无需修改，新模型文件名保持一致
- [x] 5.2 替换 `species_database.json` 文件为新的 10,964 条版本
- [x] 5.3 确认 `SpeciesEntry` 结构体和 `lookup_species_name()` 函数兼容新数据库格式

## 6. 测试验证

- [x] 6.1 运行 `cargo test` 确保 Rust 单元测试全部通过
- [x] 6.2 运行 `npx vitest run` 确保前端测试全部通过
- [ ] 6.3 使用实际 RAW 图片运行端到端测试，验证分类结果包含全球鸟种（需手动验证）
- [ ] 6.4 检查分类置信度分布，校准 `SPECIES_CONFIDENCE_THRESHOLD` 是否需要微调（需手动验证）

## 7. 清理

- [x] 7.1 归档旧版 373 类模型和训练脚本到 `temp/legacy_models/`
- [x] 7.2 更新 `bird_classification.rs` 文件头部注释，反映新模型信息（ResNet34/MetaFGNet, 10,964类, DIB-10K 数据集）
