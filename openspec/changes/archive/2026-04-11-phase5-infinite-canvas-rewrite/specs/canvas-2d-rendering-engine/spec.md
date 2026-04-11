## ADDED Requirements

### Requirement: Canvas 元素初始化与 DPR 处理
系统应该在组件挂载时创建 HTMLCanvasElement，并根据设备像素比（DPR）设置正确的物理分辨率。系统还应该监听 resize 和 DPR 变化事件，重新初始化 Canvas。

#### Scenario: 初始挂载时创建 Canvas
- **WHEN** InfiniteCanvas 组件挂载
- **THEN** Canvas 元素创建，物理宽高设置为 `containerWidth * dpr × containerHeight * dpr`
- **AND** Canvas 样式宽高设置为 `containerWidth × containerHeight`（CSS 像素）
- **AND** Canvas 2D context 应用 `ctx.scale(dpr, dpr)` 变换

#### Scenario: 容器大小变化时重新初始化
- **WHEN** ResizeObserver 检测到容器大小变化
- **THEN** Canvas 物理分辨率重新计算并应用
- **AND** 触发 markDirty() 重新渲染

#### Scenario: 多显示器 DPR 变化
- **WHEN** 用户将窗口拖到 DPR 不同的显示器
- **THEN** matchMedia 监听器触发，重新检测 DPR
- **AND** Canvas 物理分辨率更新
- **AND** 触发 markDirty() 重新渲染

### Requirement: 按需渲染循环（Dirty Flag 机制）
系统应该实现按需渲染机制，只有在状态改变时才触发重新绘制，静止时完全停止渲染以节省 CPU。

#### Scenario: 静止状态下无渲染
- **WHEN** 用户不进行任何操作（无滚轮、无拖拽、无选中、无动画）
- **THEN** requestAnimationFrame 不被调度
- **AND** Canvas 不进行任何绘制操作

#### Scenario: 滚轮操作触发渲染
- **WHEN** 用户滚动鼠标滚轮
- **THEN** handleWheel 调用 markDirty()
- **AND** requestAnimationFrame 被调度，renderFrame 执行一次
- **AND** renderFrame 完成后 dirtyRef 置为 false

#### Scenario: 多个事件在同一帧内触发
- **WHEN** 用户在同一帧内进行多个操作（如快速滚轮 + 选中）
- **THEN** 只有第一个 markDirty() 调度 rAF，后续 markDirty() 调用被忽略
- **AND** renderFrame 执行一次综合所有变化

#### Scenario: 分组切换动画期间持续渲染
- **WHEN** 分组切换动画进行中（400ms）
- **THEN** 每一帧 renderFrame 都执行（持续 rAF 调度）
- **AND** 动画结束后回到按需渲染

### Requirement: 坐标系统与变换
系统应该统一处理屏幕坐标（canvas 物理像素）与内容坐标（布局坐标）的转换，支持缩放和平移。

#### Scenario: 屏幕坐标转内容坐标
- **WHEN** 用户在屏幕坐标 (screenX, screenY) 点击
- **THEN** 内容坐标计算为 `contentX = (screenX - offsetX) / actualZoom`，`contentY = (screenY - offsetY) / actualZoom`

#### Scenario: Canvas 上下文应用变换
- **WHEN** renderFrame 绘制内容层
- **THEN** 调用 `ctx.save()`，`ctx.translate(offsetX, offsetY)`，`ctx.scale(actualZoom, actualZoom)`
- **AND** 绘制所有 item 后调用 `ctx.restore()` 恢复变换

#### Scenario: 缩放锚点（鼠标位置）
- **WHEN** 用户使用 Ctrl+滚轮缩放，鼠标在屏幕坐标 (mx, my)
- **THEN** 锚点 (mx - offsetX) / oldZoom 应该在缩放后保持相同屏幕位置
- **AND** 新的 offsetX 计算为 `mx - anchorX * newZoom`

### Requirement: 事件处理与分发
系统应该用标准 PointerEvents 处理用户交互，并通过坐标变换将屏幕事件转换为内容坐标事件，分发给 hitTest。

#### Scenario: 鼠标滚轮缩放
- **WHEN** 用户按住 Ctrl 并滚动鼠标滚轮
- **THEN** calculateZoomChange() 计算缩放增量（灵敏度 0.001）
- **AND** clamp 缩放到 [0.1, 3.0]
- **AND** 计算新的 offsetX、offsetY 保持锚点
- **AND** markDirty() 触发重新渲染

#### Scenario: 鼠标拖拽平移
- **WHEN** 用户按住鼠标并移动超过 5px 死区
- **THEN** 每个 pointermove 事件更新 offsetX、offsetY
- **AND** updateViewport() 预加载/卸载虚拟化区域的 item
- **AND** markDirty() 触发重新渲染

#### Scenario: 鼠标点击选中
- **WHEN** 用户点击且未超过死区（点击行为）
- **THEN** 遍历 canvasItemsRef 中所有 alpha > 0 的 item
- **AND** 对每个 item 调用 hitTest(contentX, contentY)
- **AND** 第一个命中的 item 调用 toggleSelection(hash)
- **AND** 调用 syncSelectionVisuals()、markDirty()

#### Scenario: 鼠标悬停高亮
- **WHEN** 用户移动鼠标（非拖拽）
- **THEN** 遍历可见 item，hitTest 找到悬停目标
- **AND** 当前 hovered item 调用 setHovered(false)
- **AND** 新 hovered item 调用 setHovered(true)
- **AND** markDirty()

### Requirement: CanvasImageItem 集成与调用
系统应该为每个可见的 CanvasImageItem 实例调用 draw() 方法，在 Canvas 上绘制图片、选中框、悬停框、信息覆盖层。

#### Scenario: 绘制单个 item
- **WHEN** renderFrame 执行，遍历 canvasItemsRef.current.values()
- **THEN** 对每个 item 调用 `draw(ctx, actualZoom, now)`
- **AND** draw() 返回布尔值表示是否需要下一帧（用于动画检测）

#### Scenario: Item 图片加载完成后更新视图
- **WHEN** ImageLoader 异步加载完成，调用 setImage(imageBitmap)
- **THEN** markDirty() 被调用，renderFrame 重新绘制该 item

#### Scenario: 低缩放时隐藏信息覆盖层
- **WHEN** actualZoom < 0.3（30%）
- **THEN** CanvasImageItem.updateZoomVisibility(0.3) 被调用
- **AND** draw() 中信息覆盖层 alpha 为 0，不绘制

### Requirement: 波点背景与分组标题
系统应该绘制波点背景（固定视口，不受缩放平移影响）和分组标题（跟随缩放但不平移）。

#### Scenario: 波点背景绘制
- **WHEN** renderFrame 开始绘制
- **THEN** 在坐标变换前调用 dotBackground.draw(ctx, screenW, screenH)
- **AND** 波点使用 OffscreenCanvas pattern，根据主题（亮/暗）确定颜色

#### Scenario: 分组标题绘制
- **WHEN** renderFrame 在应用内容变换后绘制
- **THEN** 调用 drawGroupTitles(ctx, visibleGroupTitles)
- **AND** 每个标题根据 groupIndex 的位置绘制（y 坐标在内容坐标系）

### Requirement: 虚拟化与视口更新
系统应该使用现有的 viewport.ts 虚拟化逻辑，计算当前可见区域，增删 CanvasImageItem，加载/卸载图片缓存。

#### Scenario: 计算当前可见区域
- **WHEN** 用户拖拽或缩放时触发 updateViewport()
- **THEN** 根据 offsetX、offsetY、actualZoom 计算 viewportRect
- **AND** 调用 getVisibleItems(layout, viewportRect)、diffVisibleItems(prev, curr)

#### Scenario: 销毁不可见 item
- **WHEN** diffVisibleItems 返回 leave 列表
- **THEN** 对每个 leave 的 item：
  - **AND** 调用 canvasItem.destroy()
  - **AND** 从 Map 中移除
  - **AND** 调用 imageLoader.evictImage(hash)

#### Scenario: 创建可见 item
- **WHEN** diffVisibleItems 返回 enter 列表
- **THEN** 对每个 enter 的 item：
  - **AND** 创建 CanvasImageItem(layoutItem)
  - **AND** 设置 imageInfo（文件名、元数据）
  - **AND** 调用 setImageInfo()、updateZoomVisibility()
  - **AND** 异步 loadImage()，完成后调用 setImage(bitmap)、markDirty()
