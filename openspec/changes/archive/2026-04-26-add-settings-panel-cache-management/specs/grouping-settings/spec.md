## MODIFIED Requirements

### Requirement: 分组参数 UI
系统 SHALL 在设置面板中提供分组参数调节区域，包含两个带数值显示的滑块控件。TopNavBar 不再显示分组参数 popover。

#### Scenario: 滑块显示当前值
- **WHEN** 设置面板可见
- **THEN** 相似度滑块 SHALL 显示当前 similarityThreshold 值（百分比），时间间隔滑块 SHALL 显示当前 timeGapSeconds 值（秒）

#### Scenario: 仅在有分组数据时启用重分组
- **WHEN** 尚未处理任何文件夹（无分组数据）
- **THEN** 滑块 SHALL 可操作（允许提前设置偏好），但不触发重分组

#### Scenario: 通过设置面板调整参数
- **WHEN** 用户在设置面板中调整滑块值
- **THEN** 参数 SHALL 实时更新，500ms 防抖后触发重分组（如有分组数据）
