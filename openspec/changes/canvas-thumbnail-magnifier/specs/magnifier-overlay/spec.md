## ADDED Requirements

### Requirement: 悬浮放大镜组件
系统 SHALL 提供 Magnifier React 组件，以 HTML overlay 形式在画布容器内显示，当鼠标悬停在缩略图上时弹出大图预览窗口。

#### Scenario: 鼠标悬停触发放大镜
- **WHEN** 鼠标在画布上移动且 hitTest 命中一个可见的缩略图
- **THEN** 放大镜 SHALL 显示该缩略图对应的大图预览
- **AND** 放大镜位置在鼠标右上方偏移

#### Scenario: 鼠标移出隐藏放大镜
- **WHEN** 鼠标移出缩略图区域（hitTest 未命中任何缩略图）
- **THEN** 放大镜 SHALL 隐藏，以 150ms fade-out 动画消失

#### Scenario: 鼠标在缩略图间移动时切换
- **WHEN** 鼠标从一个缩略图移动到另一个缩略图
- **THEN** 放大镜 SHALL 切换显示新缩略图的大图，不重新触发 fade 动画

### Requirement: 放大镜定位策略
放大镜 SHALL 自动调整位置以避免超出视口边界。

#### Scenario: 默认右侧显示
- **WHEN** 鼠标位置距视口右边缘 > 放大镜宽度 + 偏移量
- **THEN** 放大镜 SHALL 显示在鼠标右上方

#### Scenario: 右侧空间不足时翻转
- **WHEN** 鼠标位置距视口右边缘 < 放大镜宽度 + 偏移量
- **THEN** 放大镜 SHALL 翻转到鼠标左上方

#### Scenario: 上下边界调整
- **WHEN** 放大镜位置超出视口上边缘或下边缘
- **THEN** 放大镜 SHALL 向内偏移至完全可见

### Requirement: 放大镜图片加载
放大镜 SHALL 通过 HTML `<img>` 元素独立加载 medium 质量图片，不经过 ImageBitmap LRU 缓存。

#### Scenario: 首次悬停加载
- **WHEN** 鼠标悬停到一张未加载过的缩略图
- **THEN** 放大镜 SHALL 通过后端 URL 请求 medium 质量图片
- **AND** 加载完成前显示缩略图作为占位

#### Scenario: 切换图片时加载
- **WHEN** 鼠标从一张缩略图移到另一张
- **THEN** 放大镜 SHALL 请求新图片的 medium 质量
- **AND** 新图片加载完成前保留上一张图片显示

### Requirement: 放大镜信息面板
放大镜 SHALL 在图片下方显示信息面板，包含文件名、拍摄参数和合焦评分。

#### Scenario: 显示完整信息
- **WHEN** 放大镜显示一张有完整元数据的图片
- **THEN** 信息面板 SHALL 显示文件名、光圈(f/N)、快门速度、ISO、焦距、合焦评分星级

#### Scenario: 元数据缺失
- **WHEN** 图片缺少部分元数据
- **THEN** 信息面板 SHALL 仅显示可用的字段，缺失字段不显示

#### Scenario: 合焦评分显示
- **WHEN** 图片有合焦评分（1-5星）
- **THEN** 信息面板 SHALL 以星级形式显示合焦评分

### Requirement: 放大镜尺寸
放大镜显示区域 SHALL 约为 360px 宽度，高度按图片宽高比自适应。

#### Scenario: 横向图片
- **WHEN** 预览图片为横向（宽 > 高）
- **THEN** 放大镜宽度 SHALL 为 360px，高度按比例缩放

#### Scenario: 纵向图片
- **WHEN** 预览图片为纵向（高 > 宽）
- **THEN** 放大镜宽度 SHALL 为 360px，高度按比例缩放，最大高度不超过视口高度的 80%

### Requirement: 放大镜与画布交互隔离
放大镜 SHALL 设置 `pointer-events: none`，不拦截画布的鼠标事件。

#### Scenario: 鼠标穿透放大镜
- **WHEN** 放大镜显示时鼠标移动到放大镜区域
- **THEN** 画布 SHALL 仍能接收到 pointermove 事件
- **AND** 放大镜不阻碍画布的交互（选中、拖拽等）

### Requirement: 拖拽和过渡期间隐藏放大镜
放大镜 SHALL 在拖拽或分组过渡动画期间自动隐藏。

#### Scenario: 拖拽时隐藏
- **WHEN** 用户开始拖拽画布
- **THEN** 放大镜 SHALL 立即隐藏

#### Scenario: 拖拽结束后恢复
- **WHEN** 用户结束拖拽且鼠标仍在缩略图上
- **THEN** 放大镜 SHALL 重新显示
