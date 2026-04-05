## ADDED Requirements

### Requirement: 检测框 Canvas 2D 绘制函数

系统 SHALL 提供纯函数 `drawDetectionOverlay(ctx, boxes, displayWidth, displayHeight)` 在 Canvas 2D 上下文中绘制鸟类检测框。调用时 ctx 已处于图片项的局部坐标系（原点在图片左上角）。

#### Scenario: 绘制主框（最高置信度）
- **WHEN** `boxes` 包含多个检测框
- **THEN** 系统 SHALL 以 `#22C55E`（绿色）绘制置信度最高的框，线宽 2px

#### Scenario: 绘制副框（非最高置信度）
- **WHEN** `boxes` 中存在置信度低于最大值的框
- **THEN** 系统 SHALL 以 `#EAB308`（黄色）绘制该框，线宽 2px

#### Scenario: 空检测框列表
- **WHEN** `boxes` 为空数组
- **THEN** 系统 SHALL 不执行任何绘制操作，直接返回

### Requirement: 归一化坐标到像素坐标转换

系统 SHALL 将检测框的归一化坐标 `[0, 1]` 转换为画布像素坐标，通过乘以 `displayWidth` 和 `displayHeight`。

#### Scenario: 坐标映射
- **WHEN** 检测框坐标为 `(x1=0.2, y1=0.1, x2=0.8, y2=0.9)`，displayWidth=400, displayHeight=300
- **THEN** 系统 SHALL 转换为像素坐标 `(80, 30, 320, 270)` 进行绘制

#### Scenario: EXIF 旋转后的坐标
- **WHEN** 图片经 EXIF Orientation 旋转（如 orientation=6）
- **THEN** 检测框坐标 SHALL 不做额外调整（后端已在检测时考虑旋转）

### Requirement: 最小框尺寸过滤

系统 SHALL 过滤掉像素尺寸小于 10px 的检测框，不予绘制。

#### Scenario: 框太小不绘制
- **WHEN** 检测框宽度 `(x2-x1) * displayWidth < 10` 或高度 `(y2-y1) * displayHeight < 10`
- **THEN** 系统 SHALL 跳过该框的绘制

#### Scenario: 正常尺寸绘制
- **WHEN** 检测框宽度和高度均 >= 10px
- **THEN** 系统 SHALL 正常绘制该框

### Requirement: 折角边框绘制

系统 SHALL 使用折角样式绘制检测框边框——完整的矩形轮廓线加上四角的折角标记。

#### Scenario: 绘制完整矩形边框
- **WHEN** 绘制一个检测框
- **THEN** 系统 SHALL 通过 `ctx.beginPath` + `ctx.moveTo/lineTo` 绘制完整矩形边框路径并 `ctx.stroke()`

#### Scenario: 折角尺寸
- **WHEN** 绘制检测框折角
- **THEN** 每个角的折角线段长度 SHALL 为 12px

### Requirement: 置信度标签绘制

系统 SHALL 在检测框上方绘制置信度文本标签，格式为 `"Bird: {confidence}%"`。

#### Scenario: 标签背景
- **WHEN** 绘制标签
- **THEN** 系统 SHALL 绘制黑色（`#000000`）alpha=0.7 的圆角矩形背景，padding 为 6px

#### Scenario: 标签文字
- **WHEN** 绘制标签
- **THEN** 系统 SHALL 使用 `12px system-ui` 字体、白色文字绘制置信度文本

#### Scenario: 标签位置
- **WHEN** 绘制标签
- **THEN** 标签 SHALL 位于检测框左上角上方，偏移 2px。若上方空间不足（y < 0），SHALL 向下调整到框内顶部

### Requirement: 无 PixiJS 依赖

`drawDetectionOverlay.ts` SHALL 不导入任何 `pixi.js` 模块。所有绘制通过原生 Canvas 2D API 实现。

#### Scenario: 编译检查
- **WHEN** 对 `drawDetectionOverlay.ts` 进行 import 分析
- **THEN** 不包含任何 `from 'pixi.js'` 导入
