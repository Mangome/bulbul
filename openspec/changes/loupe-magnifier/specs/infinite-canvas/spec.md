## MODIFIED Requirements

### Requirement: 命中检测
系统 SHALL 通过手动 AABB 坐标计算实现命中检测，将屏幕坐标转换为内容坐标后遍历可见 CanvasImageItem 调用 hitTest(contentX, contentY)。悬停命中时 SHALL 通知 Loupe 组件并传递缩略图位置信息。

#### Scenario: 点击命中
- **WHEN** 用户点击画布
- **THEN** 系统将屏幕坐标转换为内容坐标，遍历当前分组的可见 CanvasImageItem 调用 hitTest()

#### Scenario: 悬停命中
- **WHEN** 鼠标在画布上移动（非拖拽状态）
- **THEN** 系统使用相同的坐标转换和 hitTest() 逻辑检测悬停目标
- **AND** 命中时将 item 的 { x, y, width, height } 传递给 Loupe 组件
- **AND** 持续更新鼠标位置给 Loupe 组件

### Requirement: 滚轮缩放
系统 SHALL 支持以鼠标 Y 轴位置为锚点的滚轮缩放，缩放范围 10%~300%。放大镜可见时普通滚轮 SHALL 调节放大镜倍率而非滚动画布。

#### Scenario: 鼠标锚点缩放
- **WHEN** 用户在画布上滚动 Ctrl+滚轮
- **THEN** 以鼠标位置为锚点调整 actualZoom，缩放后鼠标下方的内容保持不变

#### Scenario: 缩放范围限制
- **WHEN** 缩放级别达到 10% 或 300%
- **THEN** 继续滚动不再改变缩放级别

#### Scenario: 缩放同步到 Store
- **WHEN** 缩放级别变化
- **THEN** useCanvasStore.zoomLevel SHALL 同步更新

#### Scenario: 放大镜可见时滚轮调节倍率
- **WHEN** 放大镜可见且用户滚动普通滚轮（无 Ctrl/Meta 修饰键）
- **THEN** 滚轮事件 SHALL 调节放大镜倍率而非滚动画布

#### Scenario: 放大镜不可见时滚轮正常滚动
- **WHEN** 放大镜不可见且用户滚动普通滚轮
- **THEN** 画布 SHALL 正常纵向滚动
