## Requirements

### Requirement: 主 InfiniteCanvas React 组件
系统 SHALL 提供 InfiniteCanvas React 组件，管理原生 Canvas DOM 元素、渲染循环、事件监听、CanvasImageItem 池、Magnifier 组件、与 Zustand store 的同步。

#### Scenario: 组件挂载与初始化
- **WHEN** InfiniteCanvas 组件挂载
- **THEN** useEffect 执行，调用 setupCanvas() 设置物理分辨率和 DPR 缩放
- **AND** 创建 DotBackground、ImageLoader 实例
- **AND** 设置 ResizeObserver、matchMedia 监听
- **AND** 绑定 wheel、pointerdown、pointermove、pointerup 事件
- **AND** 触发初始 updateViewport()、markDirty()

#### Scenario: 组件卸载清理
- **WHEN** InfiniteCanvas 组件卸载
- **THEN** 清理所有事件监听
- **AND** cancelAnimationFrame(rafIdRef.current)
- **AND** 销毁所有 CanvasImageItem 对象
- **AND** ImageLoader.destroy()
- **AND** ResizeObserver.disconnect()

#### Scenario: JSX 包含 Magnifier 组件
- **WHEN** InfiniteCanvas 组件 render
- **THEN** 返回的 JSX 中 SHALL 包含 Magnifier 组件，作为 Canvas 的兄弟元素

### Requirement: Canvas 2D 渲染循环
系统 SHALL 使用 dirty flag + requestAnimationFrame 按需渲染驱动画布，静止时零 CPU 开销。

#### Scenario: 渲染触发
- **WHEN** 任何状态变化调用 markDirty()
- **THEN** 调度 requestAnimationFrame 执行 renderFrame()
- **AND** 同一帧内多次 markDirty() 仅调度一次 rAF

#### Scenario: 渲染帧执行
- **WHEN** renderFrame() 执行
- **THEN** 清空画布 → 填充背景色 → 绘制 DotBackground → ctx.save/translate/scale 进入内容坐标系 → 绘制 GroupTitle + 遍历可见 CanvasImageItem 调用 draw() → ctx.restore
- **AND** item.draw() 返回 boolean，如有动画进行中自动继续 rAF
- **AND** GroupTitle.drawGroupTitles() SHALL 被调用绘制分组标题

#### Scenario: DPR 处理
- **WHEN** setupCanvas() 执行
- **THEN** 设置 canvas 物理分辨率为 CSS 尺寸 × devicePixelRatio
- **AND** ctx.scale(dpr, dpr) 确保绘制清晰

#### Scenario: 窗口 resize 响应
- **WHEN** 用户调整主窗口大小
- **THEN** ResizeObserver 触发 setupCanvas() 重新设置分辨率
- **AND** 布局 SHALL 重新计算，markDirty() 触发重绘

### Requirement: 坐标系统与层级结构
画布 SHALL 维护 scrollY/zoomLevel 状态变量，通过 ctx.save/translate/scale/restore 管理两层绘制。offsetX 恒为 0，仅纵向滚动。

#### Scenario: 屏幕坐标转内容坐标
- **WHEN** 需要将屏幕坐标转换为内容坐标
- **THEN** 使用公式 contentX = (screenX - contentOffsetX) / zoomLevel, contentY = (screenY - offsetY) / zoomLevel
- **AND** contentOffsetX 由布局居中计算得出

#### Scenario: 纵向滚动偏移
- **WHEN** 用户滚轮或拖拽纵向滚动
- **THEN** offsetY = -scrollY * zoomLevel + verticalPadding
- **AND** scrollY 范围为 [0, maxScrollY]，maxScrollY = max(0, totalHeight - screenHeight / zoomLevel)

### Requirement: 滚轮缩放
系统 SHALL 支持以鼠标 Y 轴位置为锚点的滚轮缩放，缩放范围 10%~300%。

#### Scenario: 鼠标锚点缩放
- **WHEN** 用户 Ctrl+滚轮缩放
- **THEN** 以鼠标 Y 位置为锚点调整 zoomLevel，缩放后鼠标下方的内容 Y 坐标保持不变
- **AND** 无缩放补偿机制，actualZoom = zoomLevel

#### Scenario: 缩放范围限制
- **WHEN** 缩放级别达到 10% 或 300%
- **THEN** 继续滚动不再改变缩放级别

### Requirement: 拖拽纵向平移
系统 SHALL 支持鼠标左键拖拽纵向平移画布内容。

#### Scenario: 拖拽移动
- **WHEN** 用户按住鼠标左键并纵向移动
- **THEN** 画布内容跟随鼠标纵向方向平移

#### Scenario: 拖拽死区
- **WHEN** 鼠标移动距离 < 5px
- **THEN** 不触发拖拽，保留为点击事件

### Requirement: 命中检测
系统 SHALL 通过手动 AABB 坐标计算实现命中检测，将屏幕坐标转换为内容坐标后遍历可见 CanvasImageItem 调用 hitTest(contentX, contentY)。

#### Scenario: 悬停命中与放大镜联动
- **WHEN** 鼠标在画布上移动（非拖拽状态）
- **THEN** 系统 SHALL 使用坐标转换和 hitTest() 逻辑检测悬停目标
- **AND** 命中时将悬停图片信息传递给 Magnifier 组件

### Requirement: 虚拟化渲染
系统 SHALL 通过 getVisibleItems() 二分查找和 diffVisibleItems() 增量更新实现虚拟化，仅绘制视口内的图片项。

#### Scenario: 可见项计算
- **WHEN** 视口矩形更新
- **THEN** 使用二分查找确定当前视口内的 CanvasImageItem 范围
- **AND** 通过增量 diff 仅创建/销毁变化项

### Requirement: 视口状态管理
系统 SHALL 实时追踪当前视口矩形（x, y, width, height），用于虚拟化渲染。

#### Scenario: 视口更新
- **WHEN** 缩放或平移操作完成
- **THEN** 视口矩形 SHALL 更新，反映内容坐标系中的可见区域

### Requirement: useImperativeHandle 接口
系统 SHALL 暴露一个 ref handle，允许父组件调用特定的 imperative 方法。

#### Scenario: scrollToY 方法
- **WHEN** 外部组件通过 ref.current.scrollToY(y) 调用
- **THEN** 更新 scrollY 值，clamp 到 [0, maxScrollY]
- **AND** updateViewport()、markDirty()

#### Scenario: scrollToGroup 方法
- **WHEN** 外部组件通过 ref.current.scrollToGroup(groupIndex) 调用
- **THEN** 计算 groupIndex 对应的 offsetY，设置 scrollY
- **AND** updateViewport()、markDirty()

#### Scenario: updateItemMetadata 方法
- **WHEN** 外部组件通过 ref.current.updateItemMetadata(hash) 调用
- **THEN** 查询 canvasItemsRef 获取对应 item
- **AND** 调用 item.setImageInfo(fileName, metadata)
- **AND** markDirty()

### Requirement: 键盘快捷键集成
系统 SHALL 支持全局键盘快捷键（W/S 分组切换、Q 全取消、Ctrl+A 全选等）。

#### Scenario: W/S 分组切换快捷键
- **WHEN** 用户按下 W 或 S 键
- **THEN** 调用 store.previousGroup() 或 nextGroup()
- **AND** 触发分组切换动画

#### Scenario: Q 取消选中快捷键
- **WHEN** 用户按下 Q 键
- **THEN** 调用 useSelectionStore.clearSelection()
- **AND** syncSelectionVisuals()、markDirty()

#### Scenario: Ctrl+A 全选快捷键
- **WHEN** 用户按下 Ctrl+A
- **THEN** 调用 useSelectionStore.selectAll(currentGroupHash[])
- **AND** syncSelectionVisuals()、markDirty()

### Requirement: 组件 JSX 与样式
系统 SHALL 提供完整的 JSX 结构，包括 Canvas 元素和无障碍标签。

#### Scenario: Canvas 元素渲染
- **WHEN** InfiniteCanvas 组件 render
- **THEN** 返回 `<div ref={containerRef}>` 包含 `<canvas ref={canvasRef}>`
- **AND** Canvas 样式 `display: block; width: 100%; height: 100%`

#### Scenario: 无障碍标签
- **WHEN** InfiniteCanvas 渲染
- **THEN** 包含 `<div role="status" aria-live="polite">` 显示当前选中数
- **AND** 文本内容：`已选中 N 张图片` 或 `未选中图片`
