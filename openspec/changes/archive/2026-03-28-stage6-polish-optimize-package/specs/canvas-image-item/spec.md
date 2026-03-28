## MODIFIED Requirements

### Requirement: 底部信息覆盖层

每个图片项 SHALL 在底部显示半透明渐变信息覆盖层，包含文件名和拍摄参数。

#### Scenario: 渐变背景

- **WHEN** 图片项渲染
- **THEN** 底部 15% 高度 SHALL 渲染线性渐变背景（transparent → rgba(0,0,0,0.7)）

#### Scenario: 信息行 1

- **WHEN** 图片项渲染
- **THEN** 覆盖层第一行 SHALL 显示文件名 Badge

#### Scenario: 信息行 2

- **WHEN** 图片项渲染且元数据可用
- **THEN** 覆盖层第二行 SHALL 显示光圈、快门、ISO、焦段 Badge（半透明黑色背景，白色文字，pill 圆角）

#### Scenario: 低缩放隐藏

- **WHEN** 缩放级别 < 30%
- **THEN** 信息覆盖层 SHALL 隐藏（`visible = false`），减少渲染开销

#### Scenario: 缩放阈值过渡

- **WHEN** 缩放级别从 29% 变化到 31%
- **THEN** 信息覆盖层 SHALL 平滑渐入（alpha 过渡），避免突兀的显示/隐藏切换
