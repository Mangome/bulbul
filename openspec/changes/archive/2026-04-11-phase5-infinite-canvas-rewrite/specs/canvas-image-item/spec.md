## MODIFIED Requirements

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
