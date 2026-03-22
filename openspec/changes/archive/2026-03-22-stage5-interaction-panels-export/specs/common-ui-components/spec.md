## ADDED Requirements

### Requirement: Button 组件

系统 SHALL 提供通用 Button 组件，支持 `variant`（primary / secondary / ghost）、`size`（sm / md）、`disabled` 状态、`onClick` 回调。

#### Scenario: Primary 按钮渲染

- **WHEN** 渲染 `<Button variant="primary">导出</Button>`
- **THEN** 显示蓝色背景（#3B82F6）白色文字的按钮

#### Scenario: Disabled 状态

- **WHEN** 渲染 `<Button disabled>导出</Button>`
- **THEN** 按钮显示半透明灰色，点击不触发 onClick

#### Scenario: Ghost 按钮

- **WHEN** 渲染 `<Button variant="ghost">适应窗口</Button>`
- **THEN** 显示透明背景按钮，悬停时显示浅灰背景

### Requirement: Slider 组件

系统 SHALL 提供通用 Slider 组件，支持 `min`、`max`、`value`、`step`、`onChange` 回调。

#### Scenario: 滑块值变化

- **WHEN** 用户拖动滑块到新位置
- **THEN** onChange 回调被调用，传入新值

#### Scenario: 受控模式

- **WHEN** 外部 value prop 变化
- **THEN** 滑块位置同步更新

### Requirement: Badge 组件

系统 SHALL 提供通用 Badge 组件，支持显示数字或文本内容，采用 pill 形状。

#### Scenario: 数字 Badge

- **WHEN** 渲染 `<Badge>3</Badge>`
- **THEN** 显示一个 pill 形状的小标签，内容为 "3"

#### Scenario: 零值 Badge

- **WHEN** 渲染 `<Badge>0</Badge>`
- **THEN** Badge 正常显示（具体是否隐藏由父组件控制）
