## Context

bulbul 的鸟种分类模块 (`bird_classification.rs`) 使用 ResNet34 全球鸟类分类模型（10,964 种），从 osea_mobile 项目迁移而来。迁移后 Top-1 准确率下降，原因是搜索空间扩大导致视觉相似的近缘种概率被摊薄。

osea_mobile 项目已有完整的 BirdLife International 物种地理分布数据库 `avonet.db`（SQLite，103MB），包含 3 张表：
- `places`：19,561 个地理网格区域（约 1°×1° 矩形边界框）
- `distributions`：3,373,379 条物种→区域映射
- `sp_cls_map`：11,136 条学名→模型 cls 索引映射

经验证，`sp_cls_map.cls` 与 bulbul `species_database.json` 的 `class_id-1` 完全对应（10/10 随机样本匹配，96.4% 物种覆盖率）。

当前 bulbul 的 EXIF 解析已完整提取 GPS 坐标（`metadata.rs:77-79`），`ImageMetadata` 模型已包含 `gps_latitude/gps_longitude` 字段，但分类调用链未使用这些数据。

## Goals / Non-Goals

**Goals:**
- 利用 GPS 坐标过滤掉地理上不可能出现的鸟种，提升分类准确率
- 复用 osea_mobile 的 `avonet.db` 数据，以 1° 网格预计算格式嵌入 bulbul
- 保持无 GPS 时的原有行为（向后兼容）
- 地理过滤对推理性能的影响可忽略（<0.1ms）
- 网格数据文件体积合理（gzip 后约 2MB）

**Non-Goals:**
- 不实现交互式地图选择位置（仅使用照片 EXIF 中的 GPS）
- 不实现地理过滤的开关 UI（默认启用，无 GPS 自动降级）
- 不修改鸟类检测模型或前端代码
- 不实现动态下载或在线查询分布数据
- 不实现比 1° 网格更细粒度的地理过滤

## Decisions

### Decision 1: 使用 1° 网格预计算而非嵌入 SQLite

**选择**：从 `avonet.db` 预计算 1° 网格，生成 `species_grid_1deg.json.gz`

**替代方案**：
- A) 直接嵌入 `avonet.db`（103MB SQLite）
- B) 每物种单 bbox（168KB 但精度差）
- C) 2° 网格（507KB gzip 但精度稍低）

**理由**：
- 1° 网格与 osea_mobile 原始精度等价（北京仅多 10 种 vs 精确查询的 163 种）
- gzip 后约 2MB，可接受（远小于 103MB SQLite）
- 不需要引入 SQLite 依赖，Rust 端仅需 `serde_json` + `flate2`（已在依赖链中）
- 加载时一次性读入内存，查询为 O(1) HashMap 查找

### Decision 2: 过滤时机——softmax 后置 mask

**选择**：在 `classify_crop_with_probs()` 内部，softmax 之后应用地理过滤

**理由**：
- 过滤逻辑：将不在当地的物种概率置零，再重新归一化
- 不影响 softmax 数值稳定性（已有 max-logit 减法）
- 与多帧融合兼容：融合基于概率向量平均，过滤后的向量更集中，融合效果更好
- 对外接口只需增加 `Option<(f64, f64)>` 参数

### Decision 3: 网格数据格式——JSON + gzip

**选择**：`species_grid_1deg.json.gz`，格式为 `{"lat_idx,lng_idx": [cls0, cls1, ...]}`

**替代方案**：
- 自定义二进制格式（更小但维护成本高）
- MessagePack（需要额外依赖）

**理由**：
- JSON 可读性好，调试方便
- gzip 压缩比优秀（19MB → ~2MB）
- `flate2::read::GzDecoder` 已在 Rust 生态中成熟可用
- 网格 key 为整数坐标字符串（如 `"39,116"`），`serde_json` 直接反序列化为 `HashMap<String, Vec<u16>>`

### Decision 4: 数据预计算脚本独立于构建流程

**选择**：预计算脚本 `scripts/build_species_grid.py` 作为一次性工具，不集成到 Cargo build

**理由**：
- 网格数据在发布版本间不会变化（取决于 `avonet.db` 和模型）
- 预计算结果作为资源文件提交到 `resources/models/`
- 避免在构建流程中引入 Python 依赖

### Decision 5: 懒加载网格数据到全局缓存

**选择**：与分类器模型和物种数据库一致，使用 `lazy_static` + `Mutex<Option<...>>` 缓存

**理由**：
- 与现有 `CLASSIFIER_SESSION` 和 `SPECIES_DATABASE` 缓存模式一致
- 首次分类时加载，后续复用
- 无 GPS 时不加载（零开销）

### Decision 6: 无 GPS 时的降级策略

**选择**：GPS 为 None 时跳过过滤，保持 10,964 类全量搜索

**理由**：
- 部分相机或拍摄模式不记录 GPS
- 降级到无过滤是安全的——最差情况等同于当前行为
- 无需额外 UI 提示或日志告警

## Risks / Trade-offs

- **[覆盖率] 3.6% 物种无分布数据** → 391/10,964 物种在 `sp_cls_map` 中无映射。过滤时这些物种保留（不屏蔽），宁可误识不可漏识

- **[网格精度] 1° 网格比精确查询多 10-50 种** → 如北京精确 163 种 vs 网格 173 种。这是可接受的过估计，仍将搜索空间缩减 98.4%

- **[跨日期线] 部分物种分布跨越 ±180° 经线** → `avonet.db` 的 places 已正确处理（west 可为负，east 可为正）。预计算脚本需正确处理跨越日期线的网格单元

- **[内存占用] 网格数据加载后约占 10-15MB 内存** → JSON 反序列化后的 HashMap 含 25,786 个 key，每个 key 对应一个 Vec<u16>。对于桌面应用可接受

- **[GPS 不准确] 部分照片 GPS 偏移较大** → 1° 网格（约 111km）天然容忍 GPS 偏移，反而是一个优势

- **[数据更新] BirdLife 分布数据会随分类学修订而更新** → 当前使用 2019 年数据，短期无需更新。后续可通过替换 `species_grid_1deg.json.gz` 文件更新
