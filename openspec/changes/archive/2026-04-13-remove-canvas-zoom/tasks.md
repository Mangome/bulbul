## 1. Store 层清理

- [x] 1.1 `src/stores/useCanvasStore.ts` — 移除 `MIN_ZOOM`/`MAX_ZOOM`/`ZOOM_STEP` 常量、`zoomLevel` 状态、`fitCounter` 状态、`setZoom`/`zoomIn`/`zoomOut`/`resetZoom`/`fitToWindow` actions
- [x] 1.2 `src/stores/settingsStorage.ts` — 从 `PersistedSettings` 接口移除 `zoomLevel` 字段，从 `DEFAULTS` 和 `loadSettings()` 中移除 zoomLevel
- [x] 1.3 `src/stores/initSettings.ts` — 从 `collectSettings()` 移除 zoomLevel，移除 `setZoom(saved.zoomLevel)` 调用，从 `useCanvasStore.subscribe` 条件中移除 `state.zoomLevel !== prev.zoomLevel`

## 2. 画布渲染核心

- [x] 2.1 `src/components/canvas/InfiniteCanvas.tsx` — 移除缩放常量（`MIN_ZOOM`/`MAX_ZOOM`/`ZOOM_SENSITIVITY`/`TRACKPAD_ZOOM_SENSITIVITY`）、`zoomLevelRef`、store 订阅（`storeZoomLevel`/`setZoom`/`fitCounter`）
- [x] 2.2 `src/components/canvas/InfiniteCanvas.tsx` — 简化渲染变换：`offsetY = -scrollY + paddingTop`，移除 `ctx.scale(zoom, zoom)`，lineWidth 不再除以 zoom
- [x] 2.3 `src/components/canvas/InfiniteCanvas.tsx` — 简化 handleWheel：移除 Ctrl+滚轮缩放分支，普通滚轮 scrollY 不再除以 zoom
- [x] 2.4 `src/components/canvas/InfiniteCanvas.tsx` — 简化坐标转换：handlePointerMove/handleCanvasClick 中去掉 zoom 除法和乘法
- [x] 2.5 `src/components/canvas/InfiniteCanvas.tsx` — 简化辅助函数：`getMaxScrollY` 不再除以 zoom，`updateViewport` viewport 直接用 screenWidth/screenHeight
- [x] 2.6 `src/components/canvas/InfiniteCanvas.tsx` — 移除 `handleZoomThresholdChange` 回调，图片加载 `loadImage(hash, item.width)` 不再乘 zoom
- [x] 2.7 `src/components/canvas/InfiniteCanvas.tsx` — 移除外部缩放同步 effect（storeZoomLevel effect）和 fitToWindow effect（fitCounter effect）
- [x] 2.8 `src/components/canvas/InfiniteCanvas.tsx` — 更新 Loupe 传参移除 zoom prop，更新 item.draw() 调用传 zoom=1，更新拖拽不再除以 zoom，更新文件头注释

## 3. 子组件清理

- [x] 3.1 `src/components/canvas/CanvasImageItem.ts` — 检测框绘制条件 `zoom >= 0.4` 改为始终显示，移除 `updateZoomVisibility()` 方法
- [x] 3.2 `src/components/canvas/Loupe.tsx` — 从 props 移除 `zoom`，简化坐标映射（contentX = mouseX, offsetY = -scrollY + paddingTop）

## 4. UI 控件清理

- [x] 4.1 `src/components/panels/RightControlPanel.tsx` — 移除缩放控件区域（-/+按钮、滑块、百分比文本、适应窗口、1:1 按钮），移除相关 store 引用和 handler
- [x] 4.2 `src/hooks/useKeyboard.ts` — 移除 Ctrl+0/1/+/- 缩放快捷键

## 5. 测试更新

- [x] 5.1 `src/stores/useCanvasStore.test.ts` — 移除 setZoom/zoomIn/zoomOut/resetZoom/fitToWindow 测试，更新 beforeEach 去掉 zoomLevel
- [x] 5.2 `src/hooks/useKeyboard.test.ts` — 移除 Ctrl+=/Ctrl+- 缩放测试，更新 beforeEach 去掉 zoomLevel
- [x] 5.3 `src/components/panels/controlBar.test.tsx` — 移除缩放百分比和 resetZoom 测试，更新 beforeEach 去掉 zoomLevel

## 6. 验证

- [x] 6.1 运行 `npx tsc --noEmit` 确保无类型错误
- [x] 6.2 运行 `npx vitest run` 确保所有测试通过
