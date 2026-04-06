## ADDED Requirements

### Requirement: Canvas 颜色与背景
系统应该提供工具函数，在不同主题下设置 Canvas 背景色。

#### Scenario: 亮色主题背景
- **WHEN** 当前主题为 light
- **THEN** Canvas 背景色设置为 #FFFFFF
- **AND** 波点颜色为 #E0E4EB

#### Scenario: 暗色主题背景
- **WHEN** 当前主题为 dark
- **THEN** Canvas 背景色设置为 #0A0E1A
- **AND** 波点颜色为 #232D40

### Requirement: 文字渲染与测量
系统应该提供文字绘制辅助函数，包括字体设置、宽度测量、截断处理。

#### Scenario: 设置字体
- **WHEN** 调用 ctx.font = `${weight} ${size}px ${family}`
- **THEN** 后续 fillText() 和 measureText() 使用该字体

#### Scenario: 文字宽度测量
- **WHEN** 调用 ctx.measureText(text).width
- **THEN** 返回该文本的像素宽度（已考虑字体和缩放）

#### Scenario: 文字截断
- **WHEN** 文本宽度超过容器宽度
- **THEN** 二分查找最大可容纳字数
- **AND** 在末尾添加 "..."

### Requirement: 圆角矩形绘制
系统应该提供 roundRect() 方法用于绘制圆角矩形（Badge 背景）。

#### Scenario: 绘制圆角矩形
- **WHEN** 调用 ctx.roundRect(x, y, width, height, radius)
- **THEN** 绘制四个圆角的矩形
- **AND** 可结合 ctx.fill() 或 ctx.stroke() 完成

### Requirement: 渐变绘制
系统应该使用 ctx.createLinearGradient() 创建渐变（信息覆盖层背景）。

#### Scenario: 垂直线性渐变
- **WHEN** 绘制信息覆盖层背景
- **THEN** 从底部透明 -> 上方半透明黑色的渐变
- **AND** 使用 ctx.createLinearGradient(x0, y0, x1, y1)

### Requirement: 图像绘制与 EXIF 旋转
系统应该使用 ctx.drawImage() 并应用 EXIF Orientation 变换（由 CanvasImageItem 负责）。

#### Scenario: 无旋转图像绘制
- **WHEN** orientation = 1
- **THEN** 直接 ctx.drawImage(image, x, y, w, h)

#### Scenario: 90 度旋转图像绘制
- **WHEN** orientation = 6
- **THEN** ctx.translate(w, 0)、ctx.rotate(π/2)、ctx.drawImage(image, 0, 0, h, w)

#### Scenario: 已关闭 ImageBitmap 绘制
- **WHEN** ctx.drawImage(closedBitmap, ...) 被调用
- **THEN** 静默无操作（不抛异常）

### Requirement: 选中框与边框绘制
系统应该提供选中框、悬停框、外发光的绘制方法。

#### Scenario: 选中外发光
- **WHEN** 绘制选中 item 的外发光
- **THEN** strokeRect(x-6, y-6, w+12, h+12) 线宽 3px 颜色 #2563A8 alpha 0.2

#### Scenario: 悬停边框
- **WHEN** 绘制悬停 item 的边框
- **THEN** strokeRect(x-1, y-1, w+2, h+2) 线宽 2px 颜色 #2563A8

### Requirement: CheckMark 动画绘制
系统应该绘制 CheckMark（✓ 标记）及其弹性缩放动画。

#### Scenario: CheckMark 完整绘制
- **WHEN** CanvasImageItem.draw() 中绘制选中状态
- **THEN** 在右上角 (cx = width - 23, cy = 13) 绘制：
  - **AND** 白色外环 circle(r=15, color=#FFFFFF, alpha=0.9)
  - **AND** 品牌色圆形 circle(r=13, color=#2563A8)
  - **AND** 白色对勾 moveTo/lineTo，stroke #FFFFFF width 2.5px

#### Scenario: CheckMark 弹性缩放动画
- **WHEN** 选中状态刚开始，t 从 0 -> 1 (200ms)
- **THEN** 缩放系数 s = 1 - pow(1-t, 3) * cos(t * π * 0.5)
- **AND** ctx.scale(s, s) 绘制 CheckMark

### Requirement: Badge 绘制（参数+评分）
系统应该绘制圆角矩形 Badge，包含文字。

#### Scenario: 参数 Badge 绘制
- **WHEN** 绘制快门、光圈、ISO、焦段等参数
- **THEN** roundRect 背景 color #000000 alpha 0.5
- **AND** 字体 10px 颜色 #FFFFFF
- **AND** padding 水平 6px 垂直 3px

#### Scenario: 合焦评分 Badge 颜色
- **WHEN** 绘制评分 Badge
- **THEN** 根据分数着色：
  - **AND** 5 分: #4CAF50 (绿)
  - **AND** 4 分: #2196F3 (蓝)
  - **AND** 3 分: #FF9800 (橙)
  - **AND** 2/1 分: #F44336 (红)

### Requirement: 阴影效果
系统应该使用 ctx.shadowColor/shadowBlur/shadowOffset 绘制阴影。

#### Scenario: 文字阴影
- **WHEN** 绘制文件名
- **THEN** 可选添加 shadowColor rgba(0,0,0,0.3) shadowBlur 2
