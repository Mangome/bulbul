## Requirements

### Requirement: Detection Overlay 组件

前端 SHALL 实现一个 React 组件，在用户 hover 评分组件时，在 Pixi 画布上绘制检测框的可视化标注。

#### Scenario: Hover 时显示框

- **WHEN** 用户鼠标移动到 FocusScore UI 组件上
- **THEN** 对应的预览图上出现检测框（矩形边框），主评分框突出显示

#### Scenario: Hover 离开时隐藏框

- **WHEN** 用户鼠标离开 FocusScore 组件
- **THEN** 检测框从预览图上消失

#### Scenario: 多框可视化

- **WHEN** 图片包含 3 只鸟（3 个框），用户 hover
- **THEN** 绘制全部 3 个框，其中置信度最高的框用不同颜色（如高亮绿）标记，其余框用普通颜色

### Requirement: 检测框样式

检测框 SHALL 使用 Pixi Graphics 绘制，样式如下：
- 主框（最高置信度）：绿色边框，宽度 3px，透明度 0.8
- 副框（其他置信度）：黄色边框，宽度 2px，透明度 0.6
- 框角标记：在 4 个角各画一个小折角（~10px），增强可视性

#### Scenario: 绿色主框

- **WHEN** 绘制置信度最高的框
- **THEN** 使用绿色边框（RGB: 0, 255, 0），宽度 3px

#### Scenario: 黄色副框

- **WHEN** 绘制置信度较低的框
- **THEN** 使用黄色边框（RGB: 255, 255, 0），宽度 2px

#### Scenario: 框角效果

- **WHEN** 绘制任何框
- **THEN** 在 4 个角各绘制长约 10px、宽 2px 的折角线段

### Requirement: 置信度信息展示

检测框上方 SHALL 显示置信度文本标签，格式为 "Bird: 95%"。

#### Scenario: 标签显示

- **WHEN** 绘制检测框
- **THEN** 在框的上方偏移 5px 处显示 "Bird: {confidence}%" 文本，字体大小 12px，白色背景深色文字

#### Scenario: 多框标签不重叠

- **WHEN** 多个框相邻且标签可能重叠
- **THEN** 自动调整标签位置或使用缩写，保证可读性

### Requirement: 性能优化

Pixi Graphics 绘制 SHALL 进行缓存，避免每次 hover 都重新绘制。

#### Scenario: 首次绘制缓存

- **WHEN** 用户首次 hover，系统绘制框
- **THEN** 将 Graphics 对象缓存在组件状态中

#### Scenario: 后续 hover 复用

- **WHEN** 用户第二次 hover 同一图片
- **THEN** 直接使用缓存的 Graphics，仅改变显示状态（vis/透明度）

### Requirement: 坐标映射

由于预览图可能被缩放/裁剪显示，系统 SHALL 正确映射检测框的相对坐标 (0-1) 到 Pixi 画布的像素坐标。

#### Scenario: 缩放后的坐标映射

- **WHEN** 预览图尺寸为 400×300（显示尺寸），原始图片 800×600
- **WHEN** 检测框相对坐标 (0.2, 0.1, 0.8, 0.9)
- **THEN** 转换为画布像素坐标 (80, 30, 320, 270)

#### Scenario: 纵向图片的坐标调整

- **WHEN** 原始图片经 Orientation 旋转（宽高互换）
- **THEN** 检测框坐标不需调整（已在后端计算时考虑）

### Requirement: 未检测到主体的提示

当 `focus_score_method = Undetected` 时，FocusScore UI 组件 SHALL 显示"未检测到主体"标记，hover 时不绘制框。

#### Scenario: 未检测到提示

- **WHEN** 查看 `focus_score_method = Undetected` 的图片
- **THEN** 评分区域显示灰色文本 "未检测到主体，评分不可用"

#### Scenario: 未检测到不绘制框

- **WHEN** 用户 hover 该图片的评分区域
- **THEN** 不绘制任何框（detection_bboxes 为空）
