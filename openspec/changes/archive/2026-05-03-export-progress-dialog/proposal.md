## Why

导出流程中 Rust 端已发射 `export-progress` 事件（每拷贝一个文件发一次），但前端未消费该事件，用户在导出大量 RAW 文件时无任何进度反馈，UI 看起来像卡死。

## What Changes

- 增强 Rust 端 `ExportProgress` 结构体，新增 `current_file` 和 `elapsed_ms` 字段
- 新建前端 `ExportProgressDialog` 组件，展示导出进度（百分比、进度条、文件名、计时）
- 串联 `MainPage.handleExport`，传入 `onProgress` 回调驱动进度弹窗

## Capabilities

### New Capabilities
- `export-progress-ui`: 导出进度弹窗 UI 组件，监听 `export-progress` 事件并实时展示

### Modified Capabilities
- `batch-export`: 扩展 `ExportProgress` payload，增加 `current_file` 和 `elapsed_ms` 字段

## Impact

- `src-tauri/src/commands/export_commands.rs` — 修改 `ExportProgress` 结构体和 emit 逻辑
- `src-tauri/src/models/` — 如需独立定义 `ExportProgress` 则新增文件
- `src/services/exportService.ts` — 更新 `ExportProgress` 类型定义
- `src/components/dialogs/ExportProgressDialog.tsx` — 新建
- `src/components/dialogs/ExportProgressDialog.module.css` — 新建
- `src/windows/MainPage.tsx` — `handleExport` 串联进度弹窗
