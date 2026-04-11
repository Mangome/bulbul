## Requirements

### Requirement: 图片点击选中/取消

CanvasImageItem SHALL 通过 Canvas hitTest 响应鼠标点击事件，toggle 对应 hash 在 SelectionStore 中的选中状态。选中的图片 SHALL 显示蓝色边框（3px solid #2563A8）+ 2px 白色外阴影，带有平滑过渡动画。选中的图片右上角 SHALL 显示蓝色圆形 checkmark 标记，带有缩放弹入动画。

点击事件处理：屏幕坐标 → 内容坐标转换 `contentX = (screenX - offsetX) / actualZoom` → 遍历 canvasItemsRef → `item.hitTest(contentX, contentY)` → 第一个命中的 item 调用 `toggleSelection(hash)`。

选中状态变化时，调用 `canvasItem.setSelected(isSelected)` 更新内部动画状态，并调用 `markDirty()` 触发 Canvas 重新渲染。

#### Scenario: 点击未选中的图片

- **WHEN** 用户点击一张未选中的图片（pointerdown + pointerup 且未超过死区）
- **THEN** 屏幕坐标转换为内容坐标，遍历 canvasItemsRef 执行 hitTest，命中 item 的 hash 被 toggleSelection
- **AND** 该图片变为选中状态，蓝色边框以渐入动画出现，右上角 checkmark 以缩放弹入出现
- **AND** SelectionStore 中 selectedHashes 包含该 hash，selectedCount 加 1
- **AND** canvasItem.setSelected(true) 更新动画状态，markDirty() 触发重新渲染

#### Scenario: 点击已选中的图片

- **WHEN** 用户点击一张已选中的图片（pointerdown + pointerup 且未超过死区）
- **THEN** hitTest 命中后 toggleSelection 移除该 hash
- **AND** 该图片变为未选中状态，边框和 checkmark 以渐出动画消失
- **AND** SelectionStore 中移除该 hash，selectedCount 减 1
- **AND** canvasItem.setSelected(false) 更新动画状态，markDirty() 触发重新渲染

#### Scenario: 点击与拖拽区分

- **WHEN** 用户按下鼠标并拖动超过 5px 后释放
- **THEN** 不触发选中操作（视为画布平移）

#### Scenario: 全选/取消全选

- **WHEN** Ctrl+A 快捷键或 UI 操作
- **THEN** useSelectionStore.selectAll(currentGroupHashes)
- **AND** 遍历所有可见 item，调用 setSelected(true)
- **AND** markDirty()

### Requirement: 图片悬停高亮

CanvasImageItem SHALL 通过 Canvas hitTest 响应鼠标移动事件，悬停时显示高亮边框（2px solid #2563A8 + 外发光效果），带有平滑过渡。

悬停事件处理：pointermove 事件（非拖拽模式）→ hitTest 找到悬停目标 → 当前 hoveredItem.setHovered(false) → 新 hoveredItem.setHovered(true) → markDirty()。

#### Scenario: 鼠标悬停图片

- **WHEN** 鼠标指针进入图片区域（pointermove hitTest 命中新 item）
- **THEN** 高亮边框以 100ms 渐入出现
- **AND** canvasItem.setHovered(true) 更新动画状态，markDirty() 触发重新渲染

#### Scenario: 鼠标离开图片

- **WHEN** 鼠标指针离开图片区域（pointermove hitTest 未命中当前 hoveredItem）
- **THEN** 高亮边框以 100ms 渐出消失（如已选中则保留选中边框）
- **AND** canvasItem.setHovered(false) 更新动画状态，markDirty() 触发重新渲染
