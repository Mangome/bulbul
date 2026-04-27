## Why

每次打开同一目录，6 阶段流水线（扫描→处理→pHash→分组→完成→FocusScoring）全部重新执行，即使图片没有任何变化。对于 1000 张 NEF 文件，即使命中 medium/thumbnail 磁盘缓存，pHash 计算（8-15 秒）和 FocusScoring 鸟类检测+分类（90-260ms/张）仍需重复运行。用户频繁切换目录或重启应用时体验差，应缓存已识别的最终结果。

## What Changes

- 新增按图片 hash 的磁盘结果缓存（`$CACHE_DIR/bulbul/result/{hash}.json`），存储每张图片的完整处理结果：metadata（含 detection_bboxes、focus_score、focus_score_method）、pHash 值、文件指纹（mtime + size）
- 新增目录级分组缓存（`$CACHE_DIR/bulbul/groups/{MD5(dir_path)}.json`），存储分组结果和分组输入数据
- `process_folder` 命令增加缓存检查逻辑：缓存全部命中时直接返回，部分命中时增量处理缺失图片，全部缺失时走完整流水线
- `process_folder` 新增 `force_refresh` 参数，支持强制跳过缓存重新处理
- 流水线各阶段完成后自动写入缓存（阶段 2 写 ProcessResult，阶段 3 更新 pHash，阶段 5 写分组缓存，阶段 6 逐张更新检测结果）
- `regroup` 命令完成后更新目录分组缓存
- `reclassify` 命令完成后更新图片结果缓存和目录分组缓存
- `clear_cache` 命令同时清理 `result/` 和 `groups/` 缓存目录
- 设置面板新增「重新处理」按钮，调用 `process_folder` 时传 `force_refresh=true`
- `ImageInfoWithPhash` 添加 `Serialize`/`Deserialize` 支持

## Capabilities

### New Capabilities
- `result-cache`: 按图片 hash 存储和加载处理结果缓存，含指纹验证和增量合并逻辑

### Modified Capabilities
- `processing-pipeline`: 增加 `force_refresh` 参数和缓存检查/写入逻辑，支持缓存命中时跳过流水线
- `file-cache`: 扩展缓存目录结构，增加 `result/` 和 `groups/` 子目录的创建、清理和大小统计
- `session-state`: 新增 `process_results` 字段，缓存恢复时填充 SessionState
- `settings-panel`: 新增「重新处理」按钮

## Impact

- **Rust 后端**：新增 `models/directory_cache.rs`、`utils/result_cache.rs`；修改 `process_commands.rs`（核心流程）、`cache.rs`（目录结构）、`session.rs`（新字段）、`grouping.rs`（序列化支持）
- **IPC API**：`process_folder` 新增 `force_refresh` 可选参数（向后兼容）
- **前端**：`processService.ts` 新增 `forceRefresh` 参数，`SettingsPanel.tsx` 新增按钮
- **磁盘**：每张图片约 1-3KB JSON 额外缓存，1000 张约 1-3MB
