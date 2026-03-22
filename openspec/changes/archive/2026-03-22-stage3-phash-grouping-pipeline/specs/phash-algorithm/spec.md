## ADDED Requirements

### Requirement: pHash 感知哈希计算

系统 SHALL 实现基于 DCT-II 的 64-bit 感知哈希算法，输入为缩略图 JPEG 文件路径，输出为 `u64` 哈希值。算法流程：加载图片 → 转灰度 → 缩放到 9×8 → 2D DCT-II → 取 8×8 低频系数 → 排除 DC 分量 → 与均值比较 → 生成 64-bit hash。

#### Scenario: 计算单张图片的 pHash

- **WHEN** 提供有效的缩略图 JPEG 文件路径
- **THEN** 返回 `Ok(u64)` 感知哈希值

#### Scenario: 相同图片产生相同 hash

- **WHEN** 对同一张缩略图连续计算两次 pHash
- **THEN** 两次返回值完全相同

#### Scenario: 无效图片数据

- **WHEN** 提供不存在的文件路径或损坏的图片数据
- **THEN** 返回 `Err(AppError::ImageProcessError)`

### Requirement: 灰度矩阵构建

系统 SHALL 将输入图片转为灰度后缩放到 9×8 像素（使用 Lanczos3 滤波器），构建 `[8][9]` 的 f64 矩阵。

#### Scenario: 矩阵维度正确

- **WHEN** 输入任意尺寸的 JPEG 图片
- **THEN** 生成的矩阵维度为 8 行 × 9 列，所有值在 0.0~255.0 范围内

### Requirement: 2D DCT-II 变换

系统 SHALL 对 8×9 灰度矩阵执行 2D DCT-II 变换：先对每行做 9-point DCT，再对每列做 8-point DCT。DCT 实现 MUST 使用 `rustdct` crate。

#### Scenario: DCT 变换执行

- **WHEN** 对灰度矩阵执行 2D DCT
- **THEN** 矩阵所有值被原地更新为频域系数

### Requirement: Hash 生成

系统 SHALL 从 DCT 结果矩阵中取左上 8×8 区域（排除 [0][0] DC 分量），计算剩余 63 个系数的均值，然后逐位比较：大于均值设为 1，否则设为 0，生成 64-bit hash（按行优先顺序，从 [0][0] 到 [7][7]）。

#### Scenario: Hash 位数正确

- **WHEN** 完成 hash 生成
- **THEN** 输出为 `u64` 类型（64 位）
