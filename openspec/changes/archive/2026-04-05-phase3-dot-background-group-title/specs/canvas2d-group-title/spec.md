## ADDED Requirements

### Requirement: Canvas 2D 分组标题绘制
系统 SHALL 提供 `drawGroupTitles(ctx, titles, zoom)` 函数，在画布内容层中绘制分组标题文本。

#### Scenario: 绘制分组标题
- **WHEN** InfiniteCanvas 渲染循环在内容层变换后调用 `drawGroupTitles()`
- **THEN** 系统 SHALL 对每个 `GroupTitleItem` 使用 `ctx.fillText()` 在 (x, y) 位置绘制标题文本

### Requirement: 分组标题文字样式
分组标题 SHALL 使用固定的文字样式参数。

#### Scenario: 标题字体渲染
- **WHEN** 绘制分组标题
- **THEN** 字体 SHALL 为 `700 16px system-ui, -apple-system, sans-serif`，颜色 SHALL 为 #374151

### Requirement: 标题文本截断
系统 SHALL 在标题文本超出分组宽度时进行截断。

#### Scenario: 标题超出宽度
- **WHEN** 标题文本长度超过分组可用宽度（宽度 - padding × 2）
- **THEN** 系统 SHALL 截断文本并添加 "..." 后缀

#### Scenario: 标题未超出宽度
- **WHEN** 标题文本长度未超过分组可用宽度
- **THEN** 系统 SHALL 完整显示标题文本

### Requirement: 标题垂直居中
分组标题 SHALL 在标题区域内垂直居中显示。

#### Scenario: 标题定位
- **WHEN** 绘制分组标题
- **THEN** 标题 y 坐标 SHALL 为 `titleItem.y + (titleItem.height - textHeight) / 2`，实现垂直居中
