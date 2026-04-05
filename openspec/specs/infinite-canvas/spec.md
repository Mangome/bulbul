## ADDED Requirements

### Requirement: PixiJS Application 初始化
系统 SHALL 基于 PixiJS v8 创建 WebGL Application 实例，挂载到 MainPage 的 DOM 容器中，画布尺寸 SHALL 自动填满父容器并响应窗口 resize。

#### Scenario: 画布初始化
- **WHEN** MainPage 组件挂载且处理状态为 completed
- **THEN** 系统创建 PixiJS Application，canvas 元素填满容器，背景色为 `#F8F9FA`

#### Scenario: 窗口 resize 响应
- **WHEN** 用户调整主窗口大小
- **THEN** PixiJS renderer 自动 resize 适配新尺寸，布局 SHALL 重新计算

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

### Requirement: 滚轮缩放
系统 SHALL 支持以鼠标位置为锚点的滚轮缩放，缩放范围 10%~300%。

#### Scenario: 鼠标锚点缩放
- **WHEN** 用户在画布上滚动滚轮
- **THEN** ContentLayer 以鼠标位置为锚点进行缩放，缩放后鼠标下方的内容保持不变

#### Scenario: 缩放范围限制
- **WHEN** 缩放级别达到 10% 或 300%
- **THEN** 继续滚动不再改变缩放级别

#### Scenario: 缩放同步到 Store
- **WHEN** 缩放级别变化
- **THEN** `useCanvasStore.zoomLevel` SHALL 同步更新

### Requirement: 拖拽平移
系统 SHALL 支持鼠标左键拖拽平移画布内容。

#### Scenario: 拖拽移动
- **WHEN** 用户按住鼠标左键并移动
- **THEN** ContentLayer 跟随鼠标移动方向平移

#### Scenario: 拖拽死区
- **WHEN** 鼠标移动距离 < 5px
- **THEN** 不触发拖拽，保留为点击事件

### Requirement: 视口状态管理
系统 SHALL 实时追踪当前视口矩形（x, y, width, height），用于虚拟化渲染。

#### Scenario: 视口更新
- **WHEN** 缩放或平移操作完成
- **THEN** 视口矩形 SHALL 更新，反映 ContentLayer 坐标系中的可见区域
