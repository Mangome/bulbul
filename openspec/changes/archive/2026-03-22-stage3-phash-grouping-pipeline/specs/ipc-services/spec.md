## MODIFIED Requirements

### Requirement: processService 返回 GroupResult

`processService.processFolder` SHALL 调用 `invoke('process_folder', ...)` 并返回 `GroupResult` 类型（而非原来的 `ProcessFolderResult`）。

#### Scenario: 调用处理并返回分组结果

- **WHEN** 调用 `processService.processFolder(folderPath)`
- **THEN** 返回 `Promise<GroupResult>`，包含 `groups`、`totalImages`、`totalGroups`、`processedFiles`、`performance`

### Requirement: processService 事件监听格式

`processService.onProgress` 回调 SHALL 接收完整的 `ProcessingProgress` 对象，包含 `state`（对应完整流水线的所有阶段 scanning/processing/analyzing/grouping/completed/cancelling/cancelled/error）、`elapsedMs` 和 `estimatedRemainingMs` 字段。

#### Scenario: 接收 analyzing 阶段进度

- **WHEN** 流水线进入 analyzing 阶段
- **THEN** `onProgress` 回调的 `progress.state` 为 `"analyzing"`

#### Scenario: 时间信息可用

- **WHEN** 接收任何进度事件
- **THEN** `progress.elapsedMs` 为非 null 的毫秒数

### Requirement: processService 完成事件携带 GroupResult

`processService.onCompleted` 回调 SHALL 接收 `GroupResult` 作为参数。

#### Scenario: 完成事件

- **WHEN** 流水线处理完成
- **THEN** `onCompleted` 回调被调用，参数为完整的 `GroupResult` 对象
