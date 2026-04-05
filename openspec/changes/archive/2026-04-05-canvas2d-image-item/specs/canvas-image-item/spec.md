## MODIFIED Requirements

### Requirement: 底部信息覆盖层

每个图片项 SHALL 在底部显示半透明渐变信息覆盖层，包含文件名和拍摄参数。覆盖层逻辑 SHALL 内联到 `CanvasImageItem.draw()` 方法中，不再作为独立的 PixiJS Container 对象。

#### Scenario: 渐变背景

- **WHEN** 图片项绘制且信息覆盖层可见
- **THEN** 系统 SHALL 使用 `ctx.createLinearGradient()` 在底部绘制渐变背景（从 rgba(0,0,0,0) 到 rgba(0,0,0,0.6)）

#### Scenario: 信息行 1

- **WHEN** 图片项绘制且信息覆盖层可见
- **THEN** 覆盖层 SHALL 使用 `ctx.fillText()` 绘制文件名，字体 `600 11px system-ui`，颜色白色

#### Scenario: 信息行 2

- **WHEN** 图片项绘制且元数据可用且信息覆盖层可见
- **THEN** 覆盖层 SHALL 使用 `ctx.roundRect()` + `ctx.fillText()` 绘制光圈、快门、ISO、焦段 Badge

#### Scenario: 低缩放隐藏

- **WHEN** 缩放级别 < 30%
- **THEN** 信息覆盖层 SHALL 不绘制（跳过覆盖层绘制代码）

#### Scenario: 缩放阈值过渡

- **WHEN** 缩放级别从 29% 变化到 31%
- **THEN** 信息覆盖层 SHALL 平滑渐入（alpha 线性过渡），通过 `ctx.globalAlpha` 控制
