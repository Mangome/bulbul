## Context

当前 `DetectionOverlay.tsx` 是一个 PixiJS React 组件，通过 `Graphics` + `Container` 在画布上绘制鸟类检测框。它通过 `forwardRef` 暴露 `show()/hide()/update()` 方法，由父组件命令式调用。

Phase 2 已完成 `CanvasImageItem` 的 Canvas 2D 迁移（767 行），所有图片项的绘制已切换到原生 Canvas 2D。但检测框覆盖层仍停留在 PixiJS 实现上，这将阻塞 Phase 5（InfiniteCanvas 完整重写，移除所有 PixiJS 依赖）。

**现有实现的问题：**
1. 作为 React 组件，创建了不必要的 React 生命周期开销（useEffect, useImperativeHandle）
2. 使用 PixiJS `Graphics.lineStyle` / `Graphics.stroke` 等已废弃 API
3. 标签文字仅绘制了背景矩形，未绘制实际文本（`Graphics` 不支持文字绘制）
4. 与 CanvasImageItem 的渲染流程脱节——检测框需要跟随图片的坐标变换（缩放、平移、EXIF 旋转）

## Goals / Non-Goals

**Goals:**
- 将检测框绘制改为纯 Canvas 2D 函数，无 PixiJS 依赖
- 检测框绘制作为 `CanvasImageItem.draw()` 流程的一部分，自动继承图片的坐标变换
- 支持标签文字绘制（Canvas 2D `fillText` 原生支持）
- 保留现有检测框样式：主框绿色、副框黄色、折角、最小尺寸过滤
- 为 CanvasImageItem 增加检测数据管理 API

**Non-Goals:**
- 不改变检测数据的来源和传递机制（仍由 `focus-score-update` 事件通过 `updateItemMetadata` 传入）
- 不实现检测框交互（点击检测框触发操作等）——仅可视化
- 不在此阶段处理检测框与信息覆盖层的 Z-order 冲突（检测框绘制在覆盖层之上即可）
- 不改变 Phase 5 InfiniteCanvas 的整体架构设计

## Decisions

### 1. 纯函数模块 vs 类封装

**选择**: 纯导出函数 `drawDetectionOverlay(ctx, boxes, width, height)`

**原因**:
- 检测框绘制无内部状态，仅依赖输入参数
- 纯函数更容易测试、复用
- 与 CanvasImageItem 中其他绘制逻辑（`_drawPlaceholder`、`_drawHover`）的模式一致

**替代方案**: 作为类（如现有 PixiJS 组件的 OOP 风格）——引入不必要的实例化和状态管理开销

### 2. 检测框绘制位置（CanvasImageItem 内部 vs InfiniteCanvas 外部）

**选择**: 在 `CanvasImageItem.draw()` 的图片绘制后、选中/悬停效果前调用

**原因**:
- 检测框需要与图片精确对齐（归一化坐标 × displayWidth/Height）
- 在 `draw()` 内调用可自动继承 `ctx.translate(x, y)` 坐标变换
- 不需要在 InfiniteCanvas 层面额外管理检测框的可见性

**绘制顺序**: 图片/占位色块 → 检测框 → 信息覆盖层 → 选中/悬停效果

### 3. 标签文字实现方式

**选择**: Canvas 2D `fillText` 直接绘制，字体 `12px system-ui`

**原因**: 现有 PixiJS 实现中标签文字实际未渲染（`Graphics` 仅绘制了背景矩形）。Canvas 2D 原生支持文字绘制，可以完整实现 "Bird: 95%" 标签。

### 4. 折角绘制实现

**选择**: `ctx.beginPath` + `ctx.moveTo/lineTo` + `ctx.stroke` 连续路径

**原因**: 直接映射现有 PixiJS `Graphics.moveTo/lineTo` 逻辑，几乎 1:1 翻译。但优化为在 4 个角各画独立的折角短线段（而非绘制完整矩形边框），视觉效果更精准。

## Risks / Trade-offs

**[风险] 检测框坐标与 EXIF 旋转的交互** → 后端已在计算 bbox 时考虑了 orientation，前端无需额外调整（spec 中已确认）。但需验证 orientation=6/8 时 displayWidth/Height 是否已经是旋转后的值。

**[风险] 缩放级别下检测框线宽过细/过粗** → 检测框线宽固定为 2px 内容像素。在低缩放（0.1x）下可能不可见，在高缩放（3.0x）下可能过粗。当前方案接受此 trade-off，因为检测框仅在 hover 时短暂显示。

**[权衡] 移除 React 组件形式** → 失去 React DevTools 中的可见性。但检测框是 Canvas 内部绘制，本就无法在 React 树中检查，所以影响为零。
