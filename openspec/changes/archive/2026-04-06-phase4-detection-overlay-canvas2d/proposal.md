## Why

当前 `DetectionOverlay.tsx` 仍然是 PixiJS React 组件（依赖 `Graphics`、`Container`），但 Phase 2 已将 `CanvasImageItem` 迁移至纯 Canvas 2D。检测框覆盖层需要跟随迁移——否则 Phase 5 重写 InfiniteCanvas 时无法集成（PixiJS 将被完全移除）。此外，现有实现是独立的 React 组件（`forwardRef` + `useImperativeHandle`），实际绘制逻辑与 CanvasImageItem 高度重叠（坐标映射、缩放适配），改为纯绘制函数可大幅简化架构。

## What Changes

- 将 `DetectionOverlay.tsx`（178 行 PixiJS React 组件）改写为纯 Canvas 2D 绘制函数模块 `drawDetectionOverlay.ts`
- 移除对 `pixi.js` 的 `Graphics`/`Container` 依赖
- 检测框绘制逻辑改用 `ctx.beginPath/lineTo/stroke/fillRect/fillText` 原生 Canvas 2D API
- 在 `CanvasImageItem.draw()` 中集成检测框绘制调用（当 hover 合焦评分时触发）
- 为 `CanvasImageItem` 增加 `setDetectionBoxes()` 方法，接收 `DetectionBox[]` 数据

## Capabilities

### New Capabilities
- `canvas2d-detection-overlay`: 纯 Canvas 2D 实现的鸟类检测框绘制，作为独立模块导出绘制函数，由 CanvasImageItem 在 draw() 中调用

### Modified Capabilities
- `canvas2d-image-item`: 增加检测框绘制集成——新增 `setDetectionBoxes()`/`setDetectionVisible()` 方法，在 `draw()` 中按条件调用检测框绘制函数

## Impact

- **删除**: `src/components/DetectionOverlay.tsx`（整个文件）
- **新增**: `src/components/canvas/drawDetectionOverlay.ts`（纯函数模块）
- **修改**: `src/components/canvas/CanvasImageItem.ts`（增加检测框状态与绘制调用）
- **修改**: `src/components/canvas/CanvasImageItem.test.ts`（增加检测框相关测试）
- **依赖**: 无新增外部依赖；减少一个 `pixi.js` 使用点
