## Context

当前导出流程中，Rust 端 `export_commands.rs` 已在每拷贝一个文件后 emit `"export-progress"` 事件（payload: `{ current, total }`），前端 `exportService.ts` 也已封装 `onExportProgress()` 监听器和 `runExportFlow(onProgress?)` 参数。但 `MainPage.handleExport` 未传入 `onProgress` 回调，导致进度事件被忽略，用户导出时无任何 UI 反馈。

现有的 `ProgressDialog` 组件用于处理管线进度，包含阶段标签、spinner、进度条、文件名、计时、取消按钮等，但它的数据模型与导出进度差异较大（依赖 `ProcessingState` 枚举、`ProcessingProgress` 多字段），不适合直接复用。

## Goals / Non-Goals

**Goals:**

- 导出过程中显示模态进度弹窗，实时展示进度百分比、进度条、当前文件名、计时
- 增强 Rust 端 `ExportProgress`，补充 `current_file` 和 `elapsed_ms` 字段
- 串联 `MainPage.handleExport` → 进度弹窗，利用已有的 `runExportFlow(onProgress)` 管道

**Non-Goals:**

- 不实现取消功能（本次不增加 `Arc<AtomicBool>` 取消标志）
- 不实现并行拷贝（保持当前顺序拷贝逻辑）
- 不复用 `ProgressDialog` 组件（数据模型差异大，强行复用增加耦合）
- 不增加预估剩余时间（导出文件大小差异大，速率不稳定，估算不准）

## Decisions

### 1. 新建独立的 `ExportProgressDialog` 组件

**选择**: 新建 `ExportProgressDialog.tsx` + CSS Module，不复用 `ProgressDialog`

**理由**: `ProgressDialog` 强依赖 `ProcessingState` 枚举和 `ProcessingProgress` 结构体（含 stage、estimatedRemainingMs 等），导出流程无阶段概念。强行复用需要大量适配代码，增加耦合。独立组件更简洁，职责清晰。

**替代方案**: 复用 `ProgressDialog` 并构造适配层 — 增加复杂度，收益低。

### 2. Rust 端计时方案

**选择**: 在 `export_images` 函数入口记录 `Instant::now()`，每次 emit 时计算 `elapsed_ms`

**理由**: 简单直接，无需跨状态传递计时器。`Instant` 是 Rust 标准库零成本抽象。

**替代方案**: 前端自行计时 — 可行但不够精确（Tauri IPC 有延迟），且后端已有 `Instant` 惯例（`process_commands.rs`）。

### 3. 进度弹窗状态管理

**选择**: 在 `MainPage` 中用 `useState` 管理 `ExportProgress | null`，通过 `onProgress` 回调更新

**理由**: 导出进度是临时 UI 状态，无需存入 Zustand store。与 `ProgressDialog` 的状态管理方式一致（`useAppStore` 中的 progress 字段也是页面级使用）。

**替代方案**: 新建 Zustand store — 过度设计，导出进度不需要跨组件共享。

### 4. 进度弹窗生命周期

**选择**: `exportProgress !== null` 时显示弹窗，导出完成后置 null 关闭

**理由**: 简单的状态驱动显隐。导出完成后自动关闭，无需手动管理动画退出（与 ProgressDialog 使用 AnimatePresence 的模式一致）。

## Risks / Trade-offs

- [大量文件导出时进度弹窗可能短暂闪现后关闭] → 导出完成时加 500ms 延迟关闭，确保用户看到 100% 状态
- [RAW 文件较大，单次拷贝耗时长，进度可能"卡"在某个百分比] → 显示 `current_file` 让用户知道在拷哪个文件
- [ExportProgress 类型变更可能影响现有 exportService.test.ts] → 更新测试用例适配新字段
