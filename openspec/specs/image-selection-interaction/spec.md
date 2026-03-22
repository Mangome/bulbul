## ADDED Requirements

### Requirement: 图片点击选中/取消

CanvasImageItem SHALL 响应鼠标点击事件，toggle 对应 hash 在 SelectionStore 中的选中状态。选中的图片 SHALL 显示蓝色边框（3px solid #3B82F6）+ 2px 白色外阴影。选中的图片右上角 SHALL 显示蓝色圆形 ✓ 标记。

#### Scenario: 点击未选中的图片

- **WHEN** 用户点击一张未选中的图片
- **THEN** 该图片变为选中状态，显示蓝色边框和右上角 ✓ 标记，SelectionStore 中 selectedHashes 包含该 hash，selectedCount 加 1

#### Scenario: 点击已选中的图片

- **WHEN** 用户点击一张已选中的图片
- **THEN** 该图片变为未选中状态，隐藏边框和 ✓ 标记，SelectionStore 中移除该 hash，selectedCount 减 1

#### Scenario: 点击与拖拽区分

- **WHEN** 用户按下鼠标并拖动超过 5px 后释放
- **THEN** 不触发选中操作（视为画布平移）

### Requirement: 图片悬停高亮

CanvasImageItem SHALL 响应鼠标进入/离开事件，悬停时显示高亮边框（2px solid #3B82F6 + 外发光效果）。

#### Scenario: 鼠标悬停图片

- **WHEN** 鼠标指针进入图片区域
- **THEN** 显示蓝色高亮边框

#### Scenario: 鼠标离开图片

- **WHEN** 鼠标指针离开图片区域
- **THEN** 隐藏高亮边框（如已选中则保留选中边框）

### Requirement: SelectionStore 全选/取消全选

useSelectionStore SHALL 提供 `selectAllInGroup(groupHashes: string[])` 和 `deselectAllInGroup(groupHashes: string[])` 方法，支持按分组批量操作选中状态。

#### Scenario: 全选当前分组

- **WHEN** 调用 `selectAllInGroup` 传入一组 hash 列表
- **THEN** 这些 hash 全部加入 selectedHashes，selectedCount 更新为新的总数

#### Scenario: 取消全选当前分组

- **WHEN** 调用 `deselectAllInGroup` 传入一组 hash 列表
- **THEN** 这些 hash 从 selectedHashes 中移除，selectedCount 更新

#### Scenario: 全选后再全选不重复

- **WHEN** 对已部分选中的分组调用 `selectAllInGroup`
- **THEN** 已选中的不重复添加，最终该分组所有 hash 都在 selectedHashes 中
