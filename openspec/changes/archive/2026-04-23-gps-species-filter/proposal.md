## Why

迁移到 10,964 种全球鸟类分类模型后，搜索空间扩大导致 Top-1 准确率下降。视觉相似的近缘种（如各种柳莺、各种鹬）分布在不同地理区域，模型仅凭图像特征无法区分它们，概率被摊薄到地理上不可能出现的物种。GPS 地理过滤可以将 10,964 类缩减到 150-330 种（中国主要城市），有效消除地理上不可能的候选，显著提升分类准确率。

osea_mobile 项目已有完整的 BirdLife International 物种分布数据库（`avonet.db`），且与 bulbul 的 `species_database.json` 索引完全兼容（96.4% 覆盖率，10/10 随机样本匹配），可直接复用。

## What Changes

- 新增 1° 网格预计算的物种地理分布数据文件（从 `avonet.db` 导出，gzip 压缩约 2MB）
- 新增 Rust `geo_filter` 模块：加载网格数据，根据 GPS 坐标查询当地可能出现的物种 cls 索引集合，对分类概率向量做地理屏蔽
- 修改 `bird_classification` 模块：`classify_crop_with_probs()` 和 `classify_detections()` 增加 `Option<(f64, f64)>` GPS 参数，有 GPS 时在 softmax 后应用地理过滤
- 修改 `classify_group_with_fusion()`：融合时传递 GPS 参数
- 修改 `process_commands.rs`：从 `metadata_cache` 提取 GPS 坐标，传入分类调用
- 无 GPS 数据时保持原有行为（向后兼容，零影响）

## Capabilities

### New Capabilities
- `geo-species-filter`: 基于 GPS 坐标的鸟种地理分布过滤，将分类概率向量中地理上不可能出现的物种置零后重新归一化

### Modified Capabilities
- `global-species-classifier`: 分类接口增加可选 GPS 参数，推理后应用地理过滤
- `processing-pipeline`: FocusScoring 阶段传递 GPS 坐标到分类调用

## Impact

- **新增依赖**：无。网格数据使用 `serde_json` + `flate2` 解压（`flate2` 已在 Tauri 依赖链中）
- **数据文件**：新增 `resources/models/species_grid_1deg.json.gz`（约 2MB gzip）
- **API 变更**：`classify_detections()` 和 `classify_group_with_fusion()` 签名增加 `gps: Option<(f64, f64)>` 参数
- **前端**：无变更，物种名称和置信度通过现有 `DetectionBox` 传递
- **性能影响**：地理过滤为纯向量 mask 运算（10,964 维），耗时 <0.1ms，可忽略
