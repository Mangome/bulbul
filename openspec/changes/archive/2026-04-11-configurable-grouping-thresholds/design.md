## Context

当前分组阈值（相似度 90%、时间间隔 10 秒）硬编码在 `grouping.rs` 常量和 `process_commands.rs` 默认值中。后端 API 已支持参数化传入，但前端始终使用默认值，且没有调节 UI。

`SessionState` 保存了 `phash_cache`、`metadata_cache`、`hash_filename_map`、`hash_path_map` 等数据，但分组阶段构建的 `Vec<ImageInfoWithPhash>` 中间产物是临时的，用完即丢。重新分组需要重建此列表。

## Goals / Non-Goals

**Goals:**
- 用户可通过 UI 滑块调整相似度阈值和时间间隔
- 调整后无需重新扫描/计算 pHash，仅重新执行分组算法即可生效
- 阈值设置持久化到 settings.json，下次启动恢复
- 首次 processFolder 使用用户保存的阈值

**Non-Goals:**
- 不支持按分组单独设置不同阈值
- 不做实时拖拽预览（使用防抖触发即可，不需要逐帧更新）
- 不改变分组算法本身的逻辑（顺序扫描 + 早期终止）

## Decisions

### 1. 在 SessionState 中缓存 `Vec<ImageInfoWithPhash>`

**选择**: 新增 `image_infos: Option<Vec<ImageInfoWithPhash>>` 字段，在 `process_folder` 分组阶段构建完成后存入。

**替代方案**: 从 `phash_cache` + `metadata_cache` + `hash_*_map` 实时重建。

**理由**: 数据量极小（几百张图，几十 KB），直接缓存避免重建逻辑（需要重新排序、解析时间字符串），代码更简洁。`reset()` 时一并清空。

### 2. 新增 `regroup` IPC 命令而非复用 `process_folder`

**选择**: 独立的 `regroup(similarity_threshold, time_gap_seconds)` 命令。

**替代方案**: 在 `process_folder` 中判断是否只需重新分组。

**理由**: 职责单一。`process_folder` 是重量级的 6 阶段流水线，`regroup` 只需从缓存读取数据 → 调用分组函数 → 更新 `group_result` → 返回结果。混在一起会增加 `process_folder` 的复杂度。

### 3. 前端使用独立的 grouping settings store

**选择**: 新增 `useGroupingStore`，管理 `similarityThreshold` 和 `timeGapSeconds`，变化时通过防抖触发 regroup。

**替代方案**: 扩展 `useAppStore` 或 `useCanvasStore`。

**理由**: 关注点分离。分组参数既不属于 app 生命周期（useAppStore），也不属于画布视图（useCanvasStore）。独立 store 方便测试和维护。持久化复用现有 `settingsStorage` 机制。

### 4. UI 放置在右侧控制面板

**选择**: 在 `RightControlPanel` 中新增分组参数区域，包含两个滑块。

**替代方案**: 单独弹窗或设置页面。

**理由**: 右侧面板已有缩放滑块和主题切换，分组参数属于同类视图控制。放在面板中操作最便捷，调整后可直接看到画布变化。

### 5. regroup 的触发时机

**选择**: 滑块值变化 → 500ms 防抖 → 调用 regroup IPC → 更新 appStore.groups → 触发画布重新布局。

**理由**: 500ms 防抖平衡了响应速度和性能。分组算法本身很快（O(n) 级别，有早期终止），瓶颈在画布重新布局，防抖避免频繁布局计算。

## Risks / Trade-offs

- **[风险] ImageInfoWithPhash 需要跨 crate 可见** → `ImageInfoWithPhash` 已经是 `pub`，`SessionState` 引用 grouping 模块类型即可，无需额外改动。
- **[风险] regroup 期间用户继续操作** → regroup 是同步的且极快（< 10ms），不需要 loading 状态或取消机制。若未来图片量极大，可考虑 async 化。
- **[权衡] 内存冗余** → `image_infos` 与 `phash_cache`/`metadata_cache` 有数据重叠，但额外内存开销可忽略（几十 KB vs 应用整体几百 MB 图片缓存）。
