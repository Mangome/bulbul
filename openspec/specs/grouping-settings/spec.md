## Requirements

### Requirement: 分组阈值用户配置
系统 SHALL 提供两个可调参数：`similarityThreshold`（相似度百分比，范围 50.0-100.0，默认 90.0）和 `timeGapSeconds`（时间间隔秒数，范围 1-120，默认 10）。用户 SHALL 能通过 UI 滑块调整这两个值。

#### Scenario: 调整相似度阈值
- **WHEN** 用户将相似度滑块从 90% 调整到 80%
- **THEN** `similarityThreshold` SHALL 更新为 80.0

#### Scenario: 调整时间间隔
- **WHEN** 用户将时间间隔滑块从 10 秒调整到 30 秒
- **THEN** `timeGapSeconds` SHALL 更新为 30

#### Scenario: 阈值范围限制
- **WHEN** 用户尝试设置超出范围的值
- **THEN** 值 SHALL 被钳制到有效范围内（similarityThreshold: 50.0-100.0，timeGapSeconds: 1-120）

### Requirement: 分组阈值持久化
阈值配置 SHALL 持久化到 `$APPDATA/bulbul/settings.json`，与现有设置（zoomLevel、theme）共享同一文件。缺失字段时 SHALL 使用默认值（向后兼容）。

#### Scenario: 保存阈值到磁盘
- **WHEN** 用户调整阈值后（500ms 防抖）
- **THEN** 新值 SHALL 写入 settings.json

#### Scenario: 启动时恢复阈值
- **WHEN** 应用启动且 settings.json 中包含 similarityThreshold 和 timeGapSeconds
- **THEN** SHALL 恢复为保存的值

#### Scenario: settings.json 缺少阈值字段
- **WHEN** 应用启动且 settings.json 中不包含阈值字段（旧版本升级）
- **THEN** SHALL 使用默认值 similarityThreshold=90.0、timeGapSeconds=10

### Requirement: 动态重分组
当阈值变化时，系统 SHALL 使用缓存的 image_infos 数据重新执行分组算法，无需重新扫描文件或计算 pHash。重分组结果 SHALL 立即反映到画布上。

#### Scenario: 阈值变化触发重分组
- **WHEN** 用户调整阈值且防抖延迟（500ms）结束
- **THEN** 系统 SHALL 调用 regroup IPC 命令，使用新阈值重新分组，并更新画布显示

#### Scenario: 无已处理数据时调整阈值
- **WHEN** 用户在未处理任何文件夹时调整阈值
- **THEN** 阈值 SHALL 保存但不触发 regroup（无数据可分组）

#### Scenario: 首次处理使用自定义阈值
- **WHEN** 用户已调整阈值后打开一个新文件夹
- **THEN** processFolder SHALL 使用当前保存的阈值而非默认值

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
