## MODIFIED Requirements

### Requirement: 虚拟化视口变换计算使用新坐标系
虚拟化逻辑（viewport.ts、getVisibleItems）在 Phase 3 中完成，Phase 5 需要将其与新的 offsetX/offsetY/actualZoom 坐标系协调。

#### Scenario: ViewportRect 计算基于新坐标系
- **WHEN** updateViewport() 执行
- **THEN** 根据 offsetX、offsetY、actualZoom、screenWidth、screenHeight 计算 viewportRect：
  - **AND** `viewportRect.x = -offsetX / actualZoom`
  - **AND** `viewportRect.y = -offsetY / actualZoom`
  - **AND** `viewportRect.width = screenWidth / actualZoom`
  - **AND** `viewportRect.height = screenHeight / actualZoom`

#### Scenario: 虚拟化算法保持不变
- **WHEN** getVisibleItems() 调用
- **THEN** 使用现有算法计算可见 item 集合
- **AND** 返回列表不变（仅坐标系统改变）

#### Scenario: Diff 操作继续预加载/卸载
- **WHEN** diffVisibleItems 返回 enter/leave 集合
- **THEN** enter 中的 item 创建并异步加载
- **AND** leave 中的 item 销毁并缓存卸载
