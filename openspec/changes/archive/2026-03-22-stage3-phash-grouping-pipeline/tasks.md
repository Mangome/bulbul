## 1. pHash 感知哈希算法（core/phash.rs）

- [x] 1.1 实现 `compute_phash(jpeg_path: &Path) -> Result<u64, AppError>`：加载图片 → 转灰度 → Lanczos3 缩放到 9×8 → 构建 f64 矩阵
- [x] 1.2 实现 2D DCT-II 变换：使用 `rustdct` 对每行做 9-point DCT，再对每列做 8-point DCT
- [x] 1.3 实现 hash 生成：取 8×8 低频系数、排除 DC 分量 [0][0]、计算均值、逐位比较生成 64-bit hash
- [x] 1.4 编写单元测试：相同图片产生相同 hash、不同图片产生不同 hash、无效输入返回错误、矩阵维度验证

## 2. 相似度计算 + LRU 缓存（core/similarity.rs）

- [x] 2.1 实现 `hamming_distance(hash1: u64, hash2: u64) -> u32` 汉明距离计算
- [x] 2.2 实现 `similarity(hash1: u64, hash2: u64) -> f64` 相似度百分比计算（精度 2 位小数）
- [x] 2.3 实现 `SimilarityCache` 结构体：LRU 缓存（容量 1000）、有序 key pair、hits/misses 统计
- [x] 2.4 实现 `compute_file_similarity(path1, path2, cache) -> Result<f64>` 文件级别相似度
- [x] 2.5 编写单元测试：距离为 0/64 边界值、相似度 100%/0% 边界值、缓存命中/淘汰、对称查询

## 3. 分组算法（core/grouping.rs）

- [x] 3.1 定义 `ImageInfo` 结构体：hash、filename、file_path、capture_time、thumbnail_path
- [x] 3.2 实现 `group_images(images, similarity_threshold, time_gap_seconds, phash_cache) -> Vec<GroupData>`：顺序扫描 + 早期终止
- [x] 3.3 实现 `should_group` 辅助函数：时间检查 + 相似度检查双条件判断，缺少时间信息时跳过时间检查
- [x] 3.4 实现 `build_group_data` 辅助函数：构建 GroupData（ID、名称、平均相似度、代表图 hash、图片列表）
- [x] 3.5 编写单元测试：连续相似归组、时间断裂分组、相似度不足分组、单张自成一组、空列表、无时间信息降级、早期终止

## 4. SessionState 更新（state/session.rs）

- [x] 4.1 新增 `phash_cache: HashMap<String, u64>` 字段
- [x] 4.2 更新 `new()`、`with_cache_dir()`、`reset()` 方法包含新字段
- [x] 4.3 更新现有单元测试覆盖新字段

## 5. 处理流水线重构（commands/process_commands.rs）

- [x] 5.1 重构 `process_folder` 返回类型为 `GroupResult`（BREAKING）
- [x] 5.2 添加计时逻辑：使用 `std::time::Instant` 记录各阶段耗时，填充 `PerformanceMetrics`
- [x] 5.3 实现 Analyzing 阶段：对处理结果按 (capture_time, filename) 排序，然后并发计算 pHash（spawn_blocking + Semaphore 8 路），推送 Analyzing 阶段进度
- [x] 5.4 实现 Grouping 阶段：调用 `group_images` 执行分组，推送 Grouping 阶段进度
- [x] 5.5 更新 `emit_progress` 支持 `elapsed_ms` 和 `estimated_remaining_ms` 字段
- [x] 5.6 将 `GroupResult` 存入 `SessionState.group_result`，emit `processing-completed` 事件携带 `GroupResult`
- [x] 5.7 更新取消逻辑：在 Analyzing 阶段也检查 cancel_flag

## 6. 前端 Hooks（hooks/）

- [x] 6.1 实现 `useTauriEvents.ts`：通用事件监听 Hook，自动注册/清理 Tauri 事件监听器
- [x] 6.2 实现 `useProcessing.ts`：封装处理流水线生命周期（startProcessing、cancelProcessing、状态流转、事件监听、分组结果写入 Store）
- [x] 6.3 编写 `useTauriEvents.test.ts` 和 `useProcessing.test.ts` 单元测试

## 7. 前端 ProgressDialog 组件

- [x] 7.1 实现 `components/dialogs/ProgressDialog.tsx`：模态对话框，展示阶段文本、进度条、当前/总数计数、当前文件名、已用时间、预估剩余时间、取消按钮
- [x] 7.2 实现时间格式化工具函数（ms → "m:ss" 格式）
- [x] 7.3 编写 ProgressDialog 组件单元测试

## 8. 前端 Store + Service 更新

- [x] 8.1 更新 `useAppStore.ts`：新增 `groups`、`totalImages`、`selectedGroupId` 字段和 `setGroups`、`selectGroup`、`navigateGroup` actions
- [x] 8.2 更新 `services/processService.ts`：返回类型改为 `GroupResult`，`onCompleted` 回调携带 `GroupResult`
- [x] 8.3 更新 `MainPage.tsx`：集成 `useProcessing` Hook 和 `ProgressDialog` 组件，替换现有内联进度展示
- [x] 8.4 更新 Store 单元测试覆盖新字段和 actions

## 9. 集成验证

- [x] 9.1 `cargo build` 编译通过
- [x] 9.2 `cargo test` 所有 Rust 单元测试通过（phash + similarity + grouping + session_state + process_commands）
- [x] 9.3 前端 `vitest` 单元测试通过（hooks + store + ProgressDialog）
- [x] 9.4 端到端手动验证：选择包含 NEF 文件的文件夹 → 观察进度对话框各阶段流转 → 确认最终返回 GroupResult 到前端
