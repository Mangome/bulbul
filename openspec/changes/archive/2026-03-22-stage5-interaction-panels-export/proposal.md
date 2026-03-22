## Why

Stage 1~4 已完成 NEF 处理流水线 + pHash 分组 + PixiJS 无限画布瀑布流渲染。用户目前可以浏览分组图片，但无法与图片交互——不能选中、不能导出。缺少图片选中/取消、悬浮分组列表导航、底部控制栏和批量导出功能，用户无法完成"筛选 → 导出"的核心工作流。本阶段将补齐这些交互能力，使应用达到 MVP 可用状态。

## What Changes

- 图片点击选中/取消，显示蓝色边框 + ✓ 标记，悬停高亮效果
- 新增悬浮分组列表面板（FloatingGroupList），支持分组点击跳转画布位置
- 新增悬浮控制栏（FloatingControlBar），含缩放滑块、适应窗口、实际大小、导出按钮
- 新增键盘快捷键系统：W/S 分组切换、Ctrl+O 打开文件夹、Ctrl+E 导出、Ctrl+A 全选当前组、Escape 取消/清除、缩放快捷键
- 新增批量导出功能：Rust 端文件复制 + 冲突重命名 + 进度推送 + 错误收集
- 完善 `useSelectionStore`，支持全选/取消全选当前组
- 新增前端通用组件：Button、Slider、Badge
- 前端导出服务封装（exportService）+ 导出结果 UI 通知

## Capabilities

### New Capabilities

- `image-selection-interaction`: 画布内图片的选中/取消、悬停高亮、选中边框 + ✓ 标记渲染，以及 SelectionStore 完善（全选/取消全选当前组）
- `floating-group-list`: 左侧悬浮分组列表面板，展示分组信息（代表图、数量、相似度、已选中数），点击跳转画布位置
- `floating-control-bar`: 底部悬浮控制栏，含缩放控件（滑块/按钮/百分比/适应窗口/实际大小）和导出入口
- `keyboard-shortcuts`: 全局和主窗口键盘快捷键系统（W/S 分组切换、Ctrl 组合键、Escape）
- `batch-export`: Rust 端批量文件复制命令 + 前端导出服务封装 + 导出进度/结果 UI
- `common-ui-components`: 通用 UI 组件（Button、Slider、Badge），供面板和控制栏复用

### Modified Capabilities

_无需修改已有 spec 级行为要求。_

## Impact

- **前端新增文件（~10 个）**：`SelectionIndicator.ts`、`FloatingGroupList.tsx`、`GroupListItem.tsx`、`FloatingControlBar.tsx`、`Button.tsx`、`Slider.tsx`、`Badge.tsx`、`useKeyboard.ts`、`exportService.ts` 完善、`MainPage.tsx` 集成更新
- **Rust 新增/修改文件（~2 个）**：`export_commands.rs` 完善（批量复制逻辑）、`lib.rs` 注册新命令
- **Store 修改**：`useSelectionStore.ts` 增加全选/取消全选、`useAppStore.ts` 可能微调
- **依赖**：无新增外部依赖，均使用已有的 React + PixiJS + Zustand + Tauri API
- **预估代码量**：~2000 行（前端 ~1500 行，Rust ~500 行）
