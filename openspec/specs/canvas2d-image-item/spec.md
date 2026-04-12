## Requirements

### Requirement: Canvas 2D 图片绘制
系统 SHALL 通过 `CanvasImageItem.draw(ctx, zoom, now)` 方法将图片项绘制到指定的 `CanvasRenderingContext2D` 上。当 `alpha <= 0` 时 SHALL 跳过绘制。检测框覆盖层在 `detectionVisible` 为 true 且有检测数据时 SHALL 始终绘制（不再有缩放阈值条件）。

绘制顺序 SHALL 为：
1. 占位色块或图片（应用 EXIF Orientation）
2. 检测框覆盖层（当 `detectionVisible` 为 true 且有检测数据时）
3. 选中视觉效果

#### Scenario: 正常图片绘制
- **WHEN** `draw()` 被调用且 `image` 不为 null 且 `alpha > 0`
- **THEN** 系统 SHALL 调用 `ctx.drawImage(image, 0, 0, width, height)` 绘制图片（应用 EXIF Orientation 变换后）

#### Scenario: 占位色块绘制
- **WHEN** `draw()` 被调用且 `image` 为 null
- **THEN** 系统 SHALL 绘制 `#E0E4EB` 填充色矩形，尺寸与 `width/height` 一致

#### Scenario: 隐藏分组不绘制
- **WHEN** `draw()` 被调用且 `alpha <= 0`
- **THEN** 系统 SHALL 立即返回，不执行任何绘制操作

#### Scenario: 检测框始终绘制
- **WHEN** `draw()` 被调用且 `detectionVisible` 为 true 且 `detectionBoxes` 非空
- **THEN** 系统 SHALL 绘制检测框覆盖层，不受 zoom 值限制

### Requirement: EXIF Orientation Canvas 2D 变换
系统 SHALL 根据 EXIF Orientation 值（1-8）对图片应用正确的 `ctx.translate/rotate/scale` 变换，使图片在画布上按正确方向显示。

#### Scenario: Orientation 1（正常）
- **WHEN** orientation 为 1 或未设置
- **THEN** 不应用任何变换，直接 `ctx.drawImage(image, 0, 0, width, height)`

#### Scenario: Orientation 6（旋转 90° CW）
- **WHEN** orientation 为 6
- **THEN** 系统 SHALL 执行 `ctx.translate(width, 0)` + `ctx.rotate(PI/2)` + `ctx.drawImage(image, 0, 0, height, width)`

#### Scenario: Orientation 8（旋转 270° CW）
- **WHEN** orientation 为 8
- **THEN** 系统 SHALL 执行 `ctx.translate(0, height)` + `ctx.rotate(-PI/2)` + `ctx.drawImage(image, 0, 0, height, width)`

#### Scenario: Orientation 3（旋转 180°）
- **WHEN** orientation 为 3
- **THEN** 系统 SHALL 执行 `ctx.translate(width, height)` + `ctx.rotate(PI)` + `ctx.drawImage(image, 0, 0, width, height)`

#### Scenario: Orientation 2（水平镜像）
- **WHEN** orientation 为 2
- **THEN** 系统 SHALL 执行 `ctx.translate(width, 0)` + `ctx.scale(-1, 1)` + `ctx.drawImage(image, 0, 0, width, height)`

### Requirement: 选中视觉效果绘制
系统 SHALL 在选中状态下绘制叠加层、边框和 CheckMark，所有效果带动画过渡。

#### Scenario: 选中叠加层
- **WHEN** item 处于选中状态
- **THEN** 系统 SHALL 绘制 `#2563A8` alpha=0.08 的全尺寸叠加矩形，以及 1px alpha=0.15 的内侧描边

#### Scenario: 选中边框
- **WHEN** item 处于选中状态
- **THEN** 系统 SHALL 绘制外发光（向外扩展 6px，width=3px，alpha=0.2）和实色边框（向外扩展 1.5px，width=3px，alpha=1.0），颜色均为 `#2563A8`

#### Scenario: CheckMark 绘制
- **WHEN** item 处于选中状态
- **THEN** 系统 SHALL 在右上角（cx=width-10-13, cy=10+13）绘制白色外环（r=15, alpha=0.9）、品牌色圆形（r=13, `#2563A8`）、白色对勾线条（width=2.5px）

### Requirement: 选中动画状态机
系统 SHALL 在 `setSelected()` 调用时启动选中/取消动画，动画进度在每帧 `draw()` 中根据 `performance.now()` 计算。

#### Scenario: 选中渐入动画
- **WHEN** `setSelected(true)` 被调用
- **THEN** 系统 SHALL 启动 200ms 渐入动画：叠加层+边框 alpha 从 0 到 1，CheckMark scale 弹性从 0 到 1（`1 - pow(1-t, 3) * cos(t * PI * 0.5)`）

#### Scenario: 取消选中渐出动画
- **WHEN** `setSelected(false)` 被调用
- **THEN** 系统 SHALL 启动 120ms（200ms * 0.6）渐出动画：所有选中效果 alpha 从 1 到 0

#### Scenario: 尊重 prefers-reduced-motion
- **WHEN** 系统设置 `prefers-reduced-motion: reduce`
- **THEN** 动画时长 SHALL 为 0ms，即立即完成过渡

#### Scenario: draw() 返回需要下一帧
- **WHEN** 选中动画正在进行中（未到达终止时间）
- **THEN** `draw()` SHALL 返回 `true`（needsNextFrame），通知渲染循环继续调度下一帧

### Requirement: 悬停视觉效果绘制
系统 SHALL 在悬停且未选中状态下绘制悬停边框。

#### Scenario: 悬停边框
- **WHEN** item 处于悬停状态且未选中
- **THEN** 系统 SHALL 绘制外发光（向外扩展 4px，width=3px，alpha=0.2）和品牌色边框（向外扩展 1px，width=2px），颜色为 `#2563A8`

#### Scenario: 选中时不绘制悬停边框
- **WHEN** item 同时处于悬停和选中状态
- **THEN** 系统 SHALL 不绘制悬停边框（选中边框已覆盖）

### Requirement: AABB 命中检测
系统 SHALL 通过 `hitTest(contentX, contentY)` 方法判断给定的内容坐标是否落在图片项的矩形区域内。

#### Scenario: 坐标在图片内
- **WHEN** `contentX` 在 `[x, x+width]` 且 `contentY` 在 `[y, y+height]`
- **THEN** `hitTest()` SHALL 返回 `true`

#### Scenario: 坐标在图片外
- **WHEN** `contentX` 或 `contentY` 超出图片矩形范围
- **THEN** `hitTest()` SHALL 返回 `false`

### Requirement: 无 PixiJS 依赖
`CanvasImageItem.ts` SHALL 不导入任何 `pixi.js` 模块。所有渲染通过原生 Canvas 2D API 实现。

#### Scenario: 编译检查
- **WHEN** 对 `CanvasImageItem.ts` 进行 import 分析
- **THEN** 不包含任何 `from 'pixi.js'` 导入

### Requirement: 检测框数据管理

`CanvasImageItem` SHALL 提供 `setDetectionBoxes(boxes: DetectionBox[])` 方法设置检测框数据，以及 `setDetectionVisible(visible: boolean)` 方法控制检测框的显示/隐藏。

#### Scenario: 设置检测框数据
- **WHEN** `setDetectionBoxes([{x1: 0.2, y1: 0.1, x2: 0.8, y2: 0.9, confidence: 0.95}])` 被调用
- **THEN** 系统 SHALL 存储检测框数据，供后续 `draw()` 使用

#### Scenario: 显示检测框
- **WHEN** `setDetectionVisible(true)` 被调用且有检测框数据
- **THEN** 后续 `draw()` 调用 SHALL 绘制检测框覆盖层

#### Scenario: 隐藏检测框
- **WHEN** `setDetectionVisible(false)` 被调用
- **THEN** 后续 `draw()` 调用 SHALL 不绘制检测框覆盖层

#### Scenario: 无检测数据时不绘制
- **WHEN** `detectionVisible` 为 true 但 `detectionBoxes` 为空数组
- **THEN** 后续 `draw()` 调用 SHALL 不绘制检测框覆盖层

### Requirement: 资源清理
`CanvasImageItem.destroy()` SHALL 清理所有内部状态，但 SHALL NOT 调用 `image.close()`（ImageBitmap 生命周期由 ImageCache 管理）。

#### Scenario: destroy 调用
- **WHEN** `destroy()` 被调用
- **THEN** 系统 SHALL 将 `image` 置为 null，重置动画状态，不触碰 ImageBitmap 对象

#### Scenario: destroy 清理检测数据
- **WHEN** `destroy()` 被调用
- **THEN** 系统 SHALL 将 `detectionBoxes` 置为空数组，`detectionVisible` 置为 false

### Requirement: CanvasImageItem 在 InfiniteCanvas 渲染循环中集成
CanvasImageItem 已在 Phase 2 中完成 Canvas 2D 实现，Phase 5 需要集成进 InfiniteCanvas 的渲染循环，确保 draw() 方法被正确调用并在 Canvas 上可见。

#### Scenario: CanvasImageItem 对象存储与管理
- **WHEN** 虚拟化发现新的可见 item
- **THEN** 创建 CanvasImageItem(layoutItem) 并存储到 `canvasItemsRef.current` Map 中
- **AND** Map key 为 item.hash，value 为 CanvasImageItem 实例

#### Scenario: CanvasImageItem.draw() 被调用
- **WHEN** renderFrame 执行，遍历所有可见 item
- **THEN** 对每个 CanvasImageItem 调用 `draw(ctx, actualZoom, now)`
- **AND** draw() 返回布尔值表示动画是否进行中
- **AND** 如任何 item 返回 true，markDirty() 在下一帧继续渲染

#### Scenario: CanvasImageItem 销毁与清理
- **WHEN** 虚拟化发现 item 离开可见区域
- **THEN** 调用 canvasItem.destroy()
- **AND** 从 Map 中删除该 entry
- **AND** 相关 ImageBitmap 由 ImageLoader 管理销毁
