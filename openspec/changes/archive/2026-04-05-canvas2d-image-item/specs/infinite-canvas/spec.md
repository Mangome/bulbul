## MODIFIED Requirements

### Requirement: Stage 层级结构
画布 SHALL 维护两层绘制顺序：背景层（波点底纹，固定视口坐标系）和内容层（可缩放/平移的图片项）。图片项 SHALL 不再作为 PixiJS Container 子节点，而是由 InfiniteCanvas 在渲染循环中显式调用 `item.draw(ctx, zoom, now)` 绘制。

#### Scenario: 层级渲染顺序
- **WHEN** 画布渲染帧
- **THEN** 先绘制背景层（clearRect + 背景色 + 波点），再通过 `ctx.translate/scale` 进入内容坐标系，遍历可见 CanvasImageItem 调用 `draw()`

#### Scenario: 图片项管理
- **WHEN** 视口更新发现新的可见图片项
- **THEN** 系统 SHALL 创建 `CanvasImageItem` 实例并存入 Map，不调用 `addChild()`

#### Scenario: 图片项移除
- **WHEN** 视口更新发现图片项离开可见区域
- **THEN** 系统 SHALL 调用 `item.destroy()` 并从 Map 中移除，不调用 `removeChild()`

### Requirement: 命中检测
系统 SHALL 通过手动 AABB 坐标计算实现命中检测，替代 PixiJS 内建的 `eventMode` 事件系统。

#### Scenario: 点击命中
- **WHEN** 用户点击画布
- **THEN** 系统 SHALL 将屏幕坐标转换为内容坐标，遍历当前分组的可见 CanvasImageItem 调用 `hitTest(contentX, contentY)`

#### Scenario: 悬停命中
- **WHEN** 鼠标在画布上移动（非拖拽状态）
- **THEN** 系统 SHALL 使用相同的坐标转换和 `hitTest()` 逻辑检测悬停目标
