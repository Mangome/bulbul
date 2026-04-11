## Why

当前相似度分组的两个关键阈值（相似度百分比 90%、时间间隔 10 秒）是硬编码的，用户无法根据实际拍摄场景调整。不同场景（连拍、延时摄影、多角度拍摄）对分组粒度的需求差异很大，固定阈值会导致分组过细或过粗。需要提供 UI 让用户实时调参，并在调整后立即看到分组变化，无需重新执行完整的处理流水线。

## What Changes

- 后端 `SessionState` 新增 `image_infos` 字段，缓存首次处理后的 `Vec<ImageInfoWithPhash>`，供重新分组复用
- 后端新增 `regroup` IPC 命令，从缓存数据执行分组算法并返回新的 `GroupResult`
- 前端 `PersistedSettings` 新增 `similarityThreshold` 和 `timeGapSeconds` 字段，持久化到 settings.json
- 前端新增分组阈值 store，管理阈值状态并在变化时触发 regroup
- 前端 `processService` 新增 `regroup()` 调用，`processFolder()` 传入用户自定义阈值
- 前端 UI 新增分组参数调节面板（两个滑块：相似度、时间间隔），集成到右侧控制面板

## Capabilities

### New Capabilities
- `grouping-settings`: 分组阈值的用户配置、持久化、UI 交互和动态重分组能力

### Modified Capabilities
- `session-state`: 新增 `image_infos: Vec<ImageInfoWithPhash>` 缓存字段，支持 regroup 复用
- `grouping-algorithm`: 新增 `regroup` IPC 命令，支持仅用缓存数据重新执行分组

## Impact

- **后端**: `session.rs`（新增字段）、`process_commands.rs`（缓存 image_infos + 新增 regroup 命令）、`grouping.rs`（无变化，已支持参数化）
- **前端**: `settingsStorage.ts`、新增 grouping settings store、`processService.ts`、`useProcessing.ts`、`RightControlPanel.tsx`
- **API**: 新增 `regroup` IPC 命令（similarity_threshold: f64, time_gap_seconds: u64）
- **持久化**: `settings.json` 新增两个字段，向后兼容（缺失时使用默认值）
