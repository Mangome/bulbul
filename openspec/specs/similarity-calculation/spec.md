## Requirements

### Requirement: 汉明距离计算

系统 SHALL 提供 `hamming_distance(hash1: u64, hash2: u64) -> u32` 函数，计算两个 64-bit pHash 之间的汉明距离（不同位数）。

#### Scenario: 相同 hash 距离为 0

- **WHEN** 两个 hash 值完全相同
- **THEN** 返回汉明距离 0

#### Scenario: 完全不同 hash 距离为 64

- **WHEN** 两个 hash 值每一位都不同（如 `0x0000000000000000` 和 `0xFFFFFFFFFFFFFFFF`）
- **THEN** 返回汉明距离 64

#### Scenario: 已知 hash 对的距离

- **WHEN** 提供已知差异位数的两个 hash
- **THEN** 返回正确的汉明距离

### Requirement: 相似度百分比计算

系统 SHALL 提供 `similarity(hash1: u64, hash2: u64) -> f64` 函数，将汉明距离转换为相似度百分比，公式为 `(1.0 - distance / 64.0) * 100.0`，精度保留 2 位小数。

#### Scenario: 相同 hash 相似度为 100%

- **WHEN** 两个 hash 完全相同
- **THEN** 返回 100.0

#### Scenario: 完全不同 hash 相似度为 0%

- **WHEN** 两个 hash 每一位都不同
- **THEN** 返回 0.0

#### Scenario: 中间距离值

- **WHEN** 汉明距离为 6
- **THEN** 返回 `(1.0 - 6.0/64.0) * 100.0` 即约 90.63

### Requirement: pHash LRU 缓存

系统 SHALL 提供 `SimilarityCache` 结构，使用 LRU 缓存存储已计算的图片对相似度结果。缓存 key 使用有序 hash pair（`"{min}:{max}"`），容量为 1000。

#### Scenario: 缓存命中

- **WHEN** 查询已计算过的 (A, B) 相似度
- **THEN** 直接返回缓存值，不重新计算 pHash

#### Scenario: 对称查询命中缓存

- **WHEN** 先计算 (A, B) 再查询 (B, A) 的相似度
- **THEN** (B, A) 命中缓存，返回与 (A, B) 相同的结果

#### Scenario: 缓存淘汰

- **WHEN** 缓存已满且插入新条目
- **THEN** 最久未访问的条目被淘汰

### Requirement: 文件级别相似度计算

系统 SHALL 提供函数，输入两个缩略图文件路径，计算并返回相似度百分比。内部调用 pHash 计算 → 汉明距离 → 相似度百分比。

#### Scenario: 计算两张图片的相似度

- **WHEN** 提供两个有效的缩略图路径
- **THEN** 返回 0.0~100.0 之间的相似度百分比

#### Scenario: 图片路径无效

- **WHEN** 任一路径指向不存在的文件
- **THEN** 返回错误
