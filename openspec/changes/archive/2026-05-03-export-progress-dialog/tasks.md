## 1. Rust 后端 — 增强 ExportProgress

- [x] 1.1 修改 `ExportProgress` 结构体，新增 `current_file: Option<String>` 和 `elapsed_ms: f64` 字段
- [x] 1.2 修改 `export_images` 函数：在入口记录 `Instant::now()`，每次 emit 时计算 `elapsed_ms`
- [x] 1.3 修改 emit 点：传入 `current_file`（成功时为文件名，hash 未找到时为 None）
- [x] 1.4 运行 `cargo check` + `cargo test` 确认编译和测试通过

## 2. 前端服务层 — 更新类型定义

- [x] 2.1 更新 `src/services/exportService.ts` 中 `ExportProgress` 接口，新增 `currentFile?: string` 和 `elapsedMs: number`
- [x] 2.2 更新 `src/services/exportService.test.ts` 适配新字段

## 3. 前端 UI — ExportProgressDialog 组件

- [x] 3.1 创建 `src/components/dialogs/ExportProgressDialog.module.css`，复用 ProgressDialog 的样式变量和布局（overlay、dialog、percentText、progressBar 等），去掉阶段相关和取消按钮样式
- [x] 3.2 创建 `src/components/dialogs/ExportProgressDialog.tsx`，接收 `progress: ExportProgress | null` prop，显示标题"正在导出..."、百分比、进度条、计数、文件名、已用时间
- [x] 3.3 使用 motion/AnimatePresence 实现弹出/关闭动画

## 4. 前端串联 — MainPage 集成

- [x] 4.1 在 `MainPage` 中新增 `exportProgress` state（`useState<ExportProgress | null>(null)`）
- [x] 4.2 修改 `handleExport`：在调用 `runExportFlow` 前设初始进度，传入 `onProgress` 回调更新 state
- [x] 4.3 导出完成后延迟 500ms 置 null 关闭弹窗
- [x] 4.4 在 JSX 中渲染 `ExportProgressDialog`，传入 `exportProgress`
- [x] 4.5 运行 `npx tsc --noEmit` 确认类型检查通过
- [x] 4.6 运行 `npx vitest run` 确认前端测试通过
