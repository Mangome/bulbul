## Context

后端 `bird_detection.rs` 通过 YOLOv8s 检测鸟类主体，`process_commands.rs` 在异步合焦评分阶段将检测框数据（`detectionBboxes`）随 `focus-score-update` 事件发送到前端。前端 `MainPage.tsx` 接收后存入 `metadataMap`，再通过 `updateItemMetadata()` 调用 `canvasItem.setImageInfo()` 更新 Badge 显示。

**当前断点**：`CanvasImageItem` 已有 `detectionBoxes` / `detectionVisible` 字段和 `setDetectionBoxes()` / `setDetectionVisible()` 方法，`drawDetectionOverlay.ts` 也已实现完整绘制逻辑，但 `updateItemMetadata()` 没有桥接 `metadata.detectionBboxes` → `setDetectionBoxes()`，也没有设 `detectionVisible = true`。渲染管线最后一环未接通。

现有控制 UI 为右侧垂直工具栏 `RightControlPanel`（缩放、适应窗口、主题切换等图标按钮），采用毛玻璃面板 + 32px 图标按钮风格。

## Goals / Non-Goals

**Goals:**
- 补全检测框渲染管线，让用户看到鸟类检测区域
- 提供全局开关，用户可按需切换检测框可见性
- 叠加缩放阈值，缩小时自动隐藏避免视觉干扰
- 开关状态持久化到 settings.json

**Non-Goals:**
- 不修改后端检测算法或数据格式
- 不实现单图级别的检测框开关（仅全局开关）
- 不实现检测框的交互操作（如点击框选中、拖拽调整）
- 不新增独立的 FloatingControlBar 组件（使用现有 RightControlPanel）

## Decisions

### 1. 全局开关放在 `useCanvasStore` 而非独立 store

**选择**: 在 `useCanvasStore` 新增 `showDetectionOverlay: boolean` 字段。

**理由**: 检测框可见性与画布渲染紧密耦合——缩放阈值判断、渲染条件检查都在 InfiniteCanvas 中，使用画布 store 最自然。且 `useCanvasStore` 已有持久化机制（通过 `useSettingsSync` hook 同步到 settings.json），无需额外基础设施。

**备选**: 独立 `useDetectionStore`——过度设计，当前仅一个布尔值。

### 2. 缩放阈值硬编码为 0.4

**选择**: 在 `CanvasImageItem.draw()` 中，当 `actualZoom < 0.4` 时跳过检测框绘制。

**理由**: 现有 `INFO_OVERLAY_MIN_ZOOM = 0.3` + `INFO_OVERLAY_FADE_RANGE = 0.1` 的模式已验证可行。检测框在小缩放下信息密度过高，0.4 是合理阈值（缩放到 40% 以下时图片本身已较小，框线会重叠混乱）。

**备选**: 渐变淡出——增加复杂度但收益有限，且检测框不像文字覆盖层那样需要平滑过渡。

### 3. 切换开关时批量回填已有数据

**选择**: 当用户打开开关时，InfiniteCanvas 遍历所有可见 CanvasItem，从 `metadataMap` 读取 `detectionBboxes` 并调用 `setDetectionBoxes()` + `setDetectionVisible(true)`。

**理由**: `updateItemMetadata()` 仅在 `focus-score-update` 事件到达时触发。如果用户在评分完成后才打开开关，已有图片的检测框不会显示。批量回填确保开关立即生效。

### 4. 按钮放在 RightControlPanel

**选择**: 在现有 `RightControlPanel` 的视图区域（适应窗口/实际大小按钮下方）新增检测框切换图标按钮。

**理由**: RightControlPanel 已有视图相关按钮（适应窗口、实际大小），检测框可见性属于视图控制范畴，放在同一区域语义一致。且该组件的毛玻璃 + 图标按钮风格已被验证。

### 5. 缩放阈值检查位置

**选择**: 在 `InfiniteCanvas.renderFrame()` 中传递 `actualZoom` 给 `item.draw()`，`draw()` 内部综合判断 `detectionVisible && zoom >= 0.4`。

**理由**: 缩放信息在 `renderFrame()` 中可获取，传递给 `draw()` 后所有绘制条件集中在一处。不需要在 `drawDetectionOverlay` 中重复检查，该函数保持纯绘制职责。

## Risks / Trade-offs

- **[性能] 批量回填遍历所有可见 item** → 仅在开关切换时触发一次，不在渲染循环中，可接受。如果可见 item 极多（>500），可优化为仅处理 viewport 内的 item。
- **[UX] 默认关闭可能让用户不知道有此功能** → 通过 RightControlPanel 的图标按钮提供发现性，且 `focusScoreMethod === 'BirdRegion'` 的 Badge 已提示检测完成，用户有动力寻找检测结果。
- **[状态一致性] 淘汰重载后 detectionVisible 重置** → `CanvasImageItem.destroy()` 会清空 `detectionBoxes` 和 `detectionVisible`。图片重新加载后 `useImageLoader` 会重新调用 `setImage()`，此时需确保 `updateItemMetadata` 也能重新设置检测框。当前 `needsReload` 路径不经过 `updateItemMetadata`，需在图片重新加载后也检查并同步检测框状态。
