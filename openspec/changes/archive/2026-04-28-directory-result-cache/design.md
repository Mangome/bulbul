## Context

Bulbul 是一个 RAW 图片批量相似度分组和导出工具，使用 Tauri 2 (Rust) + React + PixiJS 构建。当前处理流水线在每次打开目录时完全重新执行 6 个阶段，即使图片没有变化。已有的磁盘缓存仅覆盖 medium/thumbnail JPEG 文件，不包含 pHash 值、分组结果、鸟类检测和分类结果。

现有缓存目录结构：
- `$CACHE_DIR/bulbul/medium/` — 2560px JPEG
- `$CACHE_DIR/bulbul/thumbnail/` — 600px JPEG

缓存 key 为 MD5(canonical_file_path)，同一文件路径始终映射同一 hash。

## Goals / Non-Goals

**Goals:**
- 重新打开同一目录时，从磁盘缓存恢复已处理结果，跳过完整流水线
- 新增/修改的图片仅增量处理，复用已有缓存
- FocusScoring 完成后逐张写入缓存，不丢失中间结果
- 与现有 medium/thumbnail 缓存使用一致的 hash 命名模式
- 提供强制重新处理的 UI 入口

**Non-Goals:**
- 不做跨目录的图片去重（同一文件出现在不同目录时各自缓存，虽然 hash 相同可复用）
- 不做缓存压缩（JSON 大小可接受）
- 不做缓存过期策略（用户手动清理）
- 不改变现有 medium/thumbnail 缓存的结构和行为

## Decisions

### 1. 两层缓存架构：按图片 hash + 目录级

**决策**：使用 `result/{hash}.json` 存储单张图片结果，`groups/{dir_hash}.json` 存储分组结果。

**替代方案**：单一目录级 JSON 文件存储所有结果。

**理由**：
- 按图片 hash 与现有 medium/thumbnail 模式一致，开发者心智模型统一
- 粒度细：文件增删只影响变化的图片，增量处理更自然
- FocusScoring 逐张完成时逐张写入，无需"先存半成品再更新"
- 同一图片跨目录可复用（hash 基于 canonical path）

### 2. 缓存验证使用 mtime + size 文件指纹

**决策**：存储每个文件的 `{modified: f64, size: u64}` 指纹，重新打开时比对。

**替代方案**：逐文件计算 MD5/SHA 哈希。

**理由**：mtime + size 在绝大多数情况下足以检测文件变化（重命名、修改、替换都会改变 mtime 或 size），且读取速度远快于逐文件哈希计算。对于 NEF 文件（20-50MB），MD5 计算耗时不可忽略。

### 3. 缓存格式为 JSON

**决策**：所有缓存文件使用 JSON 格式。

**替代方案**：bincode / msgpack 二进制格式。

**理由**：所有数据结构已实现 `Serialize`/`Deserialize`，JSON 可读性好便于调试，文件小（1-3KB/张），序列化/反序列化耗时可忽略。二进制格式在此场景下收益极小。

### 4. 增量合并策略

**决策**：部分缓存命中时，仅对 missing 图片执行流水线，与 cached 结果合并后重新分组。

**理由**：新增图片可能与已有图片相似，需要参与分组。分组是集合运算，不能只对新图片独立分组后拼接。

### 5. ImageInfoWithPhash 序列化

**决策**：启用 `chrono` 的 `serde` feature，直接为 `ImageInfoWithPhash` 派生 `Serialize`/`Deserialize`。

**替代方案**：定义 `SerializableImageInfo` 中间类型做转换。

**理由**：chrono/serde 是标准做法，直接派生更简洁，避免维护两套类型的转换代码。

## Risks / Trade-offs

- [缓存不一致] 目录中文件被外部修改但 mtime 未变（极少见）→ 可通过「重新处理」按钮强制刷新
- [缓存大小增长] 长期使用后缓存文件累积 → 已有 clear_cache 功能，用户可手动清理
- [JSON 反序列化失败] 缓存文件损坏 → 降级为完整流水线重新处理，不影响功能
- [process_folder 签名变更] 新增 `force_refresh` 参数 → 使用 `Option<bool>`，默认 None，向后兼容
