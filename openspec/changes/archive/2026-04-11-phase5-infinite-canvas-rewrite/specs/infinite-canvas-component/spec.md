## ADDED Requirements

### Requirement: 主 InfiniteCanvas React 组件
系统应该提供 InfiniteCanvas React 组件，管理 Canvas DOM 元素、渲染循环、事件监听、CanvasImageItem 池、与 Zustand store 的同步。

#### Scenario: 组件挂载与初始化
- **WHEN** InfiniteCanvas 组件挂载
- **THEN** useEffect 执行，调用 setupCanvas()
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

#### Scenario: Zustand store 变化时同步
- **WHEN** useCanvasStore、useAppStore、useSelectionStore 中的状态改变
- **THEN** 相应的 useEffect 执行同步逻辑
- **AND** 调用 syncSelectionVisuals()、markDirty()

### Requirement: useImperativeHandle 接口
系统应该暴露一个 ref handle，允许父组件调用特定的 imperative 方法。

#### Scenario: syncSelectionVisuals 方法
- **WHEN** 外部组件通过 ref.current.syncSelectionVisuals() 调用
- **THEN** 遍历 canvasItemsRef 中所有 item
- **AND** 根据 useSelectionStore.isSelected(hash) 调用 setSelected(true/false)
- **AND** markDirty()

#### Scenario: scrollToY 方法
- **WHEN** 外部组件通过 ref.current.scrollToY(y) 调用
- **THEN** 更新 scrollY 值，clamp 到 [0, maxScrollY]
- **AND** updateViewport()、markDirty()

#### Scenario: updateItemMetadata 方法
- **WHEN** 外部组件通过 ref.current.updateItemMetadata(hash) 调用
- **THEN** 查询 canvasItemsRef 获取对应 item
- **AND** 调用 item.setImageInfo(fileName, metadata)
- **AND** markDirty()

### Requirement: 键盘快捷键集成
系统应该支持全局键盘快捷键（W/S 分组切换、Q 全取消、Ctrl+A 全选等）。

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
系统应该提供完整的 JSX 结构，包括 Canvas 元素、状态标签、可选的悬浮控制栏集成。

#### Scenario: Canvas 元素渲染
- **WHEN** InfiniteCanvas 组件 render
- **THEN** 返回 `<div ref={containerRef}>` 包含 `<canvas ref={canvasRef}>`
- **AND** Canvas 样式 `display: block; width: 100%; height: 100%`

#### Scenario: 无障碍标签
- **WHEN** InfiniteCanvas 渲染
- **THEN** 包含 `<div role="status" aria-live="polite">` 显示当前选中数
- **AND** 文本内容：`已选中 N 张图片` 或 `未选中图片`
