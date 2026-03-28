## MODIFIED Requirements

### Requirement: 悬浮分组列表展示

系统 SHALL 在主窗口左侧显示悬浮分组列表面板（FloatingGroupList），以 `position: fixed` 定位于画布上方。样式 SHALL 使用 CSS Module（`FloatingGroupList.module.css`）实现，支持亮色/暗色主题。面板 SHALL 使用 `var(--panel-bg)` + `backdrop-filter: blur(20px)` + 圆角 12px + 柔和阴影。SHALL 在挂载时播放从左侧滑入的入场动画。

#### Scenario: 分组列表正常展示

- **WHEN** 处理完成后分组数据可用
- **THEN** 左侧面板显示所有分组，每项包含：代表图缩略图（50x50, 圆角 6px）、分组名称、图片数量、平均相似度百分比

#### Scenario: 显示分组内选中数量

- **WHEN** 用户在画布上选中某些图片
- **THEN** 对应分组列表项上显示已选中数量 Badge

#### Scenario: 空分组过滤

- **WHEN** 分组数据中某分组图片数量为 0
- **THEN** 该分组不在列表中显示

#### Scenario: 暗色主题面板

- **WHEN** 当前主题为 dark
- **THEN** 面板背景 SHALL 使用 `var(--panel-bg)` 暗色值，文字色使用暗色变量

### Requirement: 分组列表点击跳转

用户点击分组列表项 SHALL 触发画布滚动到对应分组位置，同时在 AppStore 中设置 selectedGroupId。

#### Scenario: 点击分组列表项跳转

- **WHEN** 用户点击分组列表中的某个分组项
- **THEN** 画布视口滚动到该分组的起始位置，AppStore 的 selectedGroupId 更新为该分组 id

#### Scenario: 当前选中分组高亮

- **WHEN** AppStore 中 selectedGroupId 有值
- **THEN** 分组列表中对应项 SHALL 显示高亮背景，区分于其他列表项

### Requirement: 分组列表 Header 信息

面板顶部 SHALL 展示标题 "相似度分组" 和副标题 "共 N 个分组"。

#### Scenario: Header 显示分组总数

- **WHEN** 处理完成后有 5 个分组
- **THEN** Header 副标题显示 "共 5 个分组"
