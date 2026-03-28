## ADDED Requirements

### Requirement: 面板出场动画

FloatingGroupList 和 FloatingControlBar SHALL 在挂载时播放入场动画（从边缘滑入 + 透明度渐入），使用 motion 库实现。

#### Scenario: 分组列表入场

- **WHEN** FloatingGroupList 首次挂载
- **THEN** 从左侧滑入（translateX: -20px → 0）+ 透明度（0 → 1），动画时长 300ms，ease-out 缓动

#### Scenario: 控制栏入场

- **WHEN** FloatingControlBar 首次挂载
- **THEN** 从底部滑入（translateY: 20px → 0）+ 透明度（0 → 1），动画时长 300ms，ease-out 缓动

### Requirement: 对话框动画

ProgressDialog SHALL 使用 motion 库实现弹出/关闭动画。

#### Scenario: 对话框弹出

- **WHEN** ProgressDialog 显示
- **THEN** 遮罩层透明度渐入（0 → 1），对话框从缩放弹出（scale: 0.95 → 1 + opacity: 0 → 1），动画时长 200ms

#### Scenario: 对话框关闭

- **WHEN** ProgressDialog 隐藏
- **THEN** 对话框缩放退出（scale: 1 → 0.95 + opacity: 1 → 0），遮罩层透明度渐出（1 → 0），动画时长 150ms

### Requirement: Toast 滑入/滑出动画

Toast 组件 SHALL 使用 motion 库的 `AnimatePresence` 实现进入和退出动画。

#### Scenario: Toast 进入

- **WHEN** 新 Toast 添加到队列
- **THEN** 从右侧滑入（translateX: 100% → 0）+ 透明度渐入，动画时长 200ms

#### Scenario: Toast 退出

- **WHEN** Toast 从队列移除
- **THEN** 向右滑出（translateX: 0 → 100%）+ 透明度渐出，动画时长 150ms

### Requirement: 按钮交互动画

Button 组件 SHALL 在点击时有轻微的缩放反馈。

#### Scenario: 按钮点击反馈

- **WHEN** 用户按下按钮
- **THEN** 按钮 SHALL 缩放至 0.97，松开后恢复 1.0，过渡时长 100ms
