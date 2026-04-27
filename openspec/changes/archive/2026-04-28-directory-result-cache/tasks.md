## 1. 数据模型与基础设施

- [x] 1.1 新增 `src-tauri/src/models/directory_cache.rs`，定义 `ImageResultCache`、`FileFingerprint`、`DirectoryGroupCache` 结构体，所有字段支持 Serialize/Deserialize
- [x] 1.2 修改 `src-tauri/src/models/mod.rs`，导出 `directory_cache` 模块
- [x] 1.3 为 `ImageInfoWithPhash` 添加 `Serialize`/`Deserialize` 派生（启用 chrono/serde feature），在 `src-tauri/src/core/grouping.rs`
- [x] 1.4 新增 `src-tauri/src/utils/result_cache.rs`，实现 `load_image_result`、`save_image_result`、`delete_image_result`、`load_group_cache`、`save_group_cache`、`delete_group_cache`、`clear_all_result_caches`、`get_result_cache_size` 函数
- [x] 1.5 修改 `src-tauri/src/utils/mod.rs`，导出 `result_cache` 模块
- [x] 1.6 修改 `src-tauri/src/utils/cache.rs`：`ensure_cache_dirs` 增加 `result/` 和 `groups/` 目录；`clear_all_cache` 增加清理这两个目录；`get_cache_size` 增加统计

## 2. SessionState 扩展

- [x] 2.1 修改 `src-tauri/src/state/session.rs`，新增 `process_results: Option<Vec<ProcessResult>>` 字段
- [x] 2.2 修改 `reset()` 方法清空 `process_results`
- [x] 2.3 添加 `restore_from_cache()` 方法，从 `DirectoryGroupCache` 和 `Vec<ImageResultCache>` 恢复所有 SessionState 字段

## 3. process_folder 缓存集成

- [x] 3.1 修改 `process_folder` 命令签名，新增 `force_refresh: Option<bool>` 参数
- [x] 3.2 在扫描阶段后添加缓存检查逻辑：加载目录缓存 → 逐个验证图片缓存 → 分类为 cached/missing
- [x] 3.3 实现缓存全部命中路径：恢复 SessionState → 返回 GroupResult → 后台 FocusScoring
- [x] 3.4 实现缓存部分命中路径：仅处理 missing 图片 → 合并结果 → 重新分组 → 保存缓存
- [x] 3.5 阶段 2 每个 ProcessResult 完成后调用 `save_image_result()` 写入缓存
- [x] 3.6 阶段 3 pHash 计算完成后更新对应 image_result 的 phash 字段并保存
- [x] 3.7 阶段 5 完成后调用 `save_group_cache()` 保存目录分组缓存
- [x] 3.8 阶段 6 FocusScoring 每张图片完成后更新 image_result 的 metadata 并保存

## 4. regroup/reclassify 缓存更新

- [x] 4.1 修改 `regroup` 命令，分组完成后调用 `save_group_cache()` 更新目录分组缓存
- [x] 4.2 修改 `reclassify` 命令，每张图片分类完成后调用 `save_image_result()` 更新图片结果缓存
- [x] 4.3 修改 `reclassify` 命令，分类全部完成后调用 `save_group_cache()` 更新目录分组缓存

## 5. 前端变更

- [x] 5.1 修改 `src/services/processService.ts`，`processFolder` 添加 `forceRefresh?: boolean` 参数，传递为 `forceRefresh` 到 IPC
- [x] 5.2 修改 `src/hooks/useProcessing.ts`，`startProcessing` 添加 `forceRefresh` 参数并传递
- [x] 5.3 修改 `src/components/panels/SettingsPanel.tsx`，新增「重新处理」按钮，调用 `startProcessing(currentFolder, true)`
- [x] 5.4 重新处理按钮在无打开目录或正在处理时禁用

## 6. 测试

- [x] 6.1 为 `result_cache.rs` 编写单元测试：save/load 往返、缓存不存在、指纹验证
- [x] 6.2 为 `directory_cache.rs` 编写单元测试：结构体序列化/反序列化
- [x] 6.3 为 `cache.rs` 扩展编写单元测试：result/groups 目录的创建、清理、大小统计
- [x] 6.4 运行 `cargo test` 确保所有测试通过
