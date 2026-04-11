## 1. 状态层：useCanvasStore 扩展

- [x] 1.1 在 `useCanvasStore` 新增 `showDetectionOverlay: boolean` 状态（默认 `false`）和 `toggleDetectionOverlay()` action
- [x] 1.2 在 `useSettingsSync` hook 中将 `showDetectionOverlay` 加入持久化字段，同步到 `$APPDATA/bulbul/settings.json`

## 2. 渲染管线桥接

- [x] 2.1 修改 `InfiniteCanvas.updateItemMetadata()`：从 `metadata.detectionBboxes` 读取数据，调用 `canvasItem.setDetectionBoxes(bboxes)`；根据 `useCanvasStore.showDetectionOverlay` 调用 `canvasItem.setDetectionVisible(showDetectionOverlay)`
- [x] 2.2 修改 `CanvasImageItem.draw()`：检测框绘制条件从 `this.detectionVisible` 改为 `this.detectionVisible && zoom >= 0.4`，将 `zoom` 参数传入 `draw()` 方法
- [x] 2.3 在 InfiniteCanvas 中监听 `showDetectionOverlay` 变化：切换为 `true` 时遍历所有可见 CanvasItem 回填 `detectionBboxes` 并设 `detectionVisible(true)`；切换为 `false` 时遍历所有 item 设 `detectionVisible(false)`

## 3. 图片重载后恢复检测框

- [x] 3.1 在图片 LRU 淘汰后重新加载的路径中，检查 `showDetectionOverlay` 状态，如为 `true` 则从 `metadataMap` 获取 `detectionBboxes` 并设置到 CanvasImageItem

## 4. UI 控件

- [x] 4.1 在 `RightControlPanel` 视图区域新增检测框切换图标按钮（如十字准星图标），点击调用 `toggleDetectionOverlay()`，激活态显示高亮背景色
- [x] 4.2 新增图标 SVG 组件（十字准星/目标图标），导入到 RightControlPanel

## 5. 测试与验证

- [x] 5.1 更新 `CanvasImageItem.test.ts`：新增测试用例验证 `zoom >= 0.4` 时检测框绘制、`zoom < 0.4` 时跳过绘制
- [x] 5.2 更新 `useCanvasStore` 测试：验证 `toggleDetectionOverlay()` 切换行为
- [ ] 5.3 手动验证：启动 `npm run tauri dev`，加载含鸟类图片的文件夹，通过 RightControlPanel 按钮切换检测框可见性，缩放至 <40% 确认自动隐藏
