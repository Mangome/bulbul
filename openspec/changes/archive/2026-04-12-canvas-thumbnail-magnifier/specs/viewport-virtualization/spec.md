## MODIFIED Requirements

### Requirement: 虚拟化视口变换计算
系统 SHALL 基于 Canvas 2D 坐标系（scrollY/zoomLevel）计算视口矩形，用于虚拟化判定。

#### Scenario: ViewportRect 计算基于纵向滚动坐标系
- **WHEN** updateViewport() 执行
- **THEN** 根据 scrollY、zoomLevel、screenWidth、screenHeight 计算 viewportRect：
  - **AND** `viewportRect.x = 0`（内容水平居中，视口 X 起始为 0）
  - **AND** `viewportRect.y = scrollY`
  - **AND** `viewportRect.width = screenWidth / zoomLevel`
  - **AND** `viewportRect.height = screenHeight / zoomLevel`

#### Scenario: 纯 Y 轴二分查找裁剪
- **WHEN** getVisibleItems() 调用
- **THEN** 系统 SHALL 在所有 items（按 Y 排序）上做二分查找，确定视口 Y 范围内的可见项
- **AND** 缓冲区上下各扩展 1 屏高度
- **AND** 不再进行水平分组过滤

#### Scenario: Diff 操作继续预加载/卸载
- **WHEN** diffVisibleItems 返回 enter/leave 集合
- **THEN** enter 中的 item 创建并异步加载
- **AND** leave 中的 item 销毁并缓存卸载

## REMOVED Requirements

### Requirement: 水平分组过滤
**Reason**: 纵向滚动模式下不再需要水平分页过滤，所有分组纵向排列
**Migration**: 虚拟化裁剪直接在全局 items 上做 Y 轴二分查找
