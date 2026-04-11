## MODIFIED Requirements

### Requirement: Canvas 事件处理中的全局快捷键
全局快捷键在 Phase 5 中需要集成进 Canvas 的事件处理循环，支持 W/S 分组切换、Q 取消选中、Ctrl+A 全选。

#### Scenario: W 键分组切换前进
- **WHEN** 用户按下 W 键（keydown）
- **THEN** 调用 useCanvasStore.nextGroup()
- **AND** 分组切换动画启动

#### Scenario: S 键分组切换后退
- **WHEN** 用户按下 S 键
- **THEN** 调用 useCanvasStore.previousGroup()
- **AND** 分组切换动画启动

#### Scenario: Q 键取消全选
- **WHEN** 用户按下 Q 键
- **THEN** 调用 useSelectionStore.clearSelection()
- **AND** syncSelectionVisuals()
- **AND** markDirty()

#### Scenario: Ctrl+A 全选当前分组
- **WHEN** 用户按下 Ctrl+A
- **THEN** 获取当前分组所有 item hashes
- **AND** 调用 useSelectionStore.selectAll(hashes)
- **AND** syncSelectionVisuals()
- **AND** markDirty()

#### Scenario: 键盘事件在 Canvas 失焦时
- **WHEN** Canvas 未获得焦点（其他元素 focused）
- **THEN** 快捷键仍可能需要全局响应（根据现有逻辑）
- **AND** 或仅在 Canvas focused 时响应（新设计优选）
