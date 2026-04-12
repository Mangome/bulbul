## MODIFIED Requirements

### Requirement: W/S 键分组切换
useKeyboard hook SHALL 监听 W 和 S 键，触发纵向滚动到上/下一组的位置，支持首尾循环。

#### Scenario: 按 S 键滚动到下一组
- **WHEN** 当前视口在分组 2 的位置（共 5 组），用户按下 S 键
- **THEN** 画布 SHALL 平滑滚动到分组 3 的 offsetY 位置

#### Scenario: 按 W 键滚动到上一组
- **WHEN** 当前视口在分组 2 的位置，用户按下 W 键
- **THEN** 画布 SHALL 平滑滚动到分组 1 的 offsetY 位置

#### Scenario: 末尾循环到开头
- **WHEN** 当前视口在最后一个分组，用户按下 S 键
- **THEN** 画布 SHALL 滚动到第一个分组的 offsetY 位置

#### Scenario: 开头循环到末尾
- **WHEN** 当前视口在第一个分组，用户按下 W 键
- **THEN** 画布 SHALL 滚动到最后一个分组的 offsetY 位置

#### Scenario: 滚动动画
- **WHEN** W/S 键触发分组切换
- **THEN** 画布 SHALL 使用 easeOutQuart 缓动平滑滚动到目标位置
- **AND** 动画期间用户可中断（新的 W/S 或滚轮操作取消当前动画）

### Requirement: Canvas 事件处理中的全局快捷键
Canvas 的键盘事件 SHALL 支持 W/S 纵向分组滚动、Q 取消选中、Ctrl+A 全选当前分组。

#### Scenario: W 键滚动到上一组
- **WHEN** 用户按下 W 键（keydown）
- **THEN** 画布 SHALL 平滑滚动到上一个分组的 offsetY 位置

#### Scenario: S 键滚动到下一组
- **WHEN** 用户按下 S 键
- **THEN** 画布 SHALL 平滑滚动到下一个分组的 offsetY 位置

#### Scenario: Q 键取消全选
- **WHEN** 用户按下 Q 键
- **THEN** 调用 useSelectionStore.clearSelection()
- **AND** syncSelectionVisuals()
- **AND** markDirty()

#### Scenario: Ctrl+A 全选当前分组
- **WHEN** 用户按下 Ctrl+A
- **THEN** 获取当前视口内分组的所有 item hashes
- **AND** 调用 useSelectionStore.selectAll(hashes)
- **AND** syncSelectionVisuals()
- **AND** markDirty()
