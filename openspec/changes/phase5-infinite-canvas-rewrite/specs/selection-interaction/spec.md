## MODIFIED Requirements

### Requirement: 选中交互通过 Canvas hitTest 实现
选中交互已在 Zustand store 中管理，Phase 5 需要将其与 Canvas 坐标变换、hitTest 集成。

#### Scenario: Canvas 点击转 hitTest
- **WHEN** 用户点击 Canvas（pointerdown + pointerup 且未超过死区）
- **THEN** 计算内容坐标 `contentX = (screenX - offsetX) / actualZoom`
- **AND** 遍历 canvasItemsRef，调用 item.hitTest(contentX, contentY)
- **AND** 第一个命中的 item 调用 toggleSelection(hash)

#### Scenario: 选中状态视觉同步
- **WHEN** useSelectionStore.isSelected(hash) 状态改变
- **THEN** 调用 canvasItem.setSelected(isSelected)
- **AND** canvasItem 更新内部动画状态
- **AND** markDirty() 触发重新渲染

#### Scenario: 全选/取消全选
- **WHEN** Ctrl+A 快捷键或 UI 操作
- **THEN** useSelectionStore.selectAll(currentGroupHashes)
- **AND** 遍历所有可见 item，调用 setSelected(true)
- **AND** markDirty()

#### Scenario: 悬停高亮
- **WHEN** pointermove 事件（非拖拽模式）
- **THEN** hitTest 找到悬停目标
- **AND** 当前 hoveredItem.setHovered(false)
- **AND** 新 hoveredItem.setHovered(true)
- **AND** markDirty()
