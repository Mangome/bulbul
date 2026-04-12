## MODIFIED Requirements

### Requirement: 坐标系统与层级结构
画布 SHALL 维护 scrollY 状态变量，通过 ctx.save/translate/restore 管理两层绘制。offsetX 恒为 0，仅纵向滚动。不再使用缩放变换。

#### Scenario: 屏幕坐标转内容坐标
- **WHEN** 需要将屏幕坐标转换为内容坐标
- **THEN** 使用公式 contentX = screenX, contentY = screenY - offsetY
- **AND** offsetY = -scrollY + paddingTop

#### Scenario: 纵向滚动偏移
- **WHEN** 用户滚轮或拖拽纵向滚动
- **THEN** offsetY = -scrollY + verticalPadding
- **AND** scrollY 范围为 [0, maxScrollY]，maxScrollY = max(0, totalHeight - screenHeight)

### Requirement: 视口状态管理
系统 SHALL 实时追踪当前视口矩形（x, y, width, height），用于虚拟化渲染。

#### Scenario: 视口更新
- **WHEN** 平移操作完成
- **THEN** 视口矩形 SHALL 更新，viewport.width = screenWidth, viewport.height = screenHeight

## REMOVED Requirements

### Requirement: 滚轮缩放
**Reason**: 新布局采用固定列数自适应宽度，缩放功能不再适用
**Migration**: Ctrl+滚轮不再触发任何操作；普通滚轮仍执行纵向滚动
