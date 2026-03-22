## MODIFIED Requirements

### Requirement: useAppStore 分组数据集成

`useAppStore` SHALL 新增以下字段和 actions 来管理分组数据：

新增字段：
- `groups: GroupData[]` — 分组数据列表
- `totalImages: number` — 图片总数
- `selectedGroupId: number | null` — 当前选中分组 ID

新增 Actions：
- `setGroups(result: GroupResult)` — 设置分组结果数据
- `selectGroup(id: number | null)` — 选中指定分组
- `navigateGroup(direction: 'prev' | 'next')` — 上/下切换分组（首尾循环）

#### Scenario: 设置分组数据

- **WHEN** 调用 `setGroups(result)` 
- **THEN** `groups` 被设为 `result.groups`，`totalImages` 被设为 `result.totalImages`，`processingState` 变为 `completed`

#### Scenario: 分组导航

- **WHEN** 当前在最后一个分组，调用 `navigateGroup('next')`
- **THEN** 循环到第一个分组

#### Scenario: 分组导航（上一个）

- **WHEN** 当前在第一个分组，调用 `navigateGroup('prev')`
- **THEN** 循环到最后一个分组

#### Scenario: 重置清空分组数据

- **WHEN** 调用 `reset()`
- **THEN** `groups` 清空，`totalImages` 置 0，`selectedGroupId` 置 null
