## 1. 后端：SessionState 扩展

- [x] 1.1 在 `SessionState` 中新增 `image_infos: Option<Vec<ImageInfoWithPhash>>` 字段，更新 `new()`、`default()`、`reset()` 方法
- [x] 1.2 更新 SessionState 现有单元测试，验证 `image_infos` 在初始化时为 None、reset 后为 None

## 2. 后端：process_folder 缓存 image_infos

- [x] 2.1 在 `process_commands.rs` 分组阶段（阶段 4）完成后，将构建的 `image_infos` 克隆存入 SessionState
- [x] 2.2 确保 `process_folder` 传入用户自定义阈值（从 IPC 参数获取）

## 3. 后端：新增 regroup IPC 命令

- [x] 3.1 在 `process_commands.rs` 中新增 `regroup` Tauri command，从 SessionState 读取 image_infos，调用 `group_images_with_phash`，更新 group_result 并返回 GroupResult
- [x] 3.2 处理 image_infos 为 None 的错误情况，返回明确的错误信息
- [x] 3.3 在 `lib.rs` 中注册 `regroup` 命令
- [x] 3.4 编写 regroup 命令的单元测试

## 4. 前端：设置持久化扩展

- [x] 4.1 在 `settingsStorage.ts` 的 `PersistedSettings` 中新增 `similarityThreshold` 和 `timeGapSeconds` 字段，设置默认值
- [x] 4.2 确保向后兼容：旧版 settings.json 缺少字段时使用默认值

## 5. 前端：分组参数 Store

- [x] 5.1 新建 `useGroupingStore.ts`，管理 `similarityThreshold`(50-100, 默认 90) 和 `timeGapSeconds`(1-120, 默认 10)
- [x] 5.2 接入 settingsStorage 持久化机制（500ms 防抖写入）
- [x] 5.3 启动时从 settings.json 恢复阈值

## 6. 前端：regroup 服务与 Hook

- [x] 6.1 在 `processService.ts` 中新增 `regroup(similarityThreshold, timeGapSeconds)` 函数，调用 regroup IPC 命令
- [x] 6.2 在 `useProcessing.ts` 中新增 regroup 处理逻辑：调用 regroup 服务 → 更新 appStore.groups
- [x] 6.3 将 `processFolder` 调用改为传入用户当前的阈值设置

## 7. 前端：UI 滑块控件

- [x] 7.1 在 `RightControlPanel.tsx` 中新增分组参数调节区域，包含相似度滑块和时间间隔滑块
- [x] 7.2 滑块显示当前数值，变化时更新 groupingStore
- [x] 7.3 groupingStore 值变化时通过 500ms 防抖触发 regroup（仅在有分组数据时）

## 8. 集成测试与验证

- [x] 8.1 运行 `cargo test` 确保后端测试全部通过
- [x] 8.2 运行 `npx vitest run` 确保前端测试全部通过
- [ ] 8.3 手动验证：打开文件夹 → 调整滑块 → 分组实时变化 → 重启应用阈值保留（需用户验证）
