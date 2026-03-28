## MODIFIED Requirements

### Requirement: 图片点击选中/取消

CanvasImageItem SHALL 响应鼠标点击事件，toggle 对应 hash 在 SelectionStore 中的选中状态。选中的图片 SHALL 显示蓝色边框（3px solid #3B82F6）+ 2px 白色外阴影，带有平滑过渡动画。选中的图片右上角 SHALL 显示蓝色圆形 checkmark 标记，带有缩放弹入动画。

#### Scenario: 点击未选中的图片

- **WHEN** 用户点击一张未选中的图片
- **THEN** 该图片变为选中状态，蓝色边框以渐入动画出现，右上角 checkmark 以缩放弹入出现，SelectionStore 中 selectedHashes 包含该 hash，selectedCount 加 1

#### Scenario: 点击已选中的图片

- **WHEN** 用户点击一张已选中的图片
- **THEN** 该图片变为未选中状态，边框和 checkmark 以渐出动画消失，SelectionStore 中移除该 hash，selectedCount 减 1

#### Scenario: 点击与拖拽区分

- **WHEN** 用户按下鼠标并拖动超过 5px 后释放
- **THEN** 不触发选中操作（视为画布平移）

### Requirement: 图片悬停高亮

CanvasImageItem SHALL 响应鼠标进入/离开事件，悬停时显示高亮边框（2px solid #3B82F6 + 外发光效果），带有平滑过渡。

#### Scenario: 鼠标悬停图片

- **WHEN** 鼠标指针进入图片区域
- **THEN** 高亮边框以 100ms 渐入出现

#### Scenario: 鼠标离开图片

- **WHEN** 鼠标指针离开图片区域
- **THEN** 高亮边框以 100ms 渐出消失（如已选中则保留选中边框）
