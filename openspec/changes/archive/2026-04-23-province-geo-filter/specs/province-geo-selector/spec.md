## ADDED Requirements

### Requirement: 省份坐标数据
系统 SHALL 提供 34 个省级行政区（含港澳台）的静态数据，每个省份包含名称、省会纬度和经度。数据 SHALL 定义在前端 `src/data/provinces.ts` 中，类型为 `Province[]`。

#### Scenario: 数据完整性
- **WHEN** 应用加载省份数据
- **THEN** SHALL 包含 34 个省级行政区，每个条目有 name（字符串）、lat（正负 90 以内的数值）、lng（正负 180 以内的数值）

#### Scenario: 坐标有效性
- **WHEN** 使用省份坐标查询地理网格
- **THEN** 所有省份坐标 SHALL 落在中国境内（lat 在 18-54 范围，lng 在 73-135 范围），且在 species_grid_1deg.json.gz 中有对应网格数据

### Requirement: 地区选择 Store
系统 SHALL 提供 `useGeoStore` Zustand store 管理当前选中的省份状态，包含 `selectedProvince: Province | null` 字段和 `setProvince` action。选中的省份 SHALL 持久化到 settings.json。

#### Scenario: 选择省份
- **WHEN** 用户选择"北京"
- **THEN** `selectedProvince` SHALL 为 `{ name: "北京", lat: 39.9, lng: 116.4 }`

#### Scenario: 清除选择
- **WHEN** 用户取消省份选择
- **THEN** `selectedProvince` SHALL 为 null

#### Scenario: 持久化恢复
- **WHEN** 应用重启后
- **THEN** `selectedProvince` SHALL 从 settings.json 恢复上次的选中值

### Requirement: TopNavBar 省份选择器
TopNavBar 工具栏 SHALL 在检测框切换按钮旁新增省份选择器按钮。按钮 SHALL 显示当前选中省份名称或"地区"（未选择时）。点击 SHALL 弹出可搜索的下拉列表，列出 34 个省级行政区。

#### Scenario: 按钮显示选中省份
- **WHEN** 用户已选择"云南"
- **THEN** 按钮文本 SHALL 显示"云南"

#### Scenario: 按钮显示默认文本
- **WHEN** 未选择任何省份
- **THEN** 按钮文本 SHALL 显示"地区"

#### Scenario: 搜索过滤
- **WHEN** 用户在搜索框输入"云"
- **THEN** 列表 SHALL 仅显示"云南"

#### Scenario: 选择省份触发重分类
- **WHEN** 用户从下拉列表选择一个省份
- **THEN** 系统 SHALL 调用后端 reclassify 命令，传入该省份的经纬度坐标

#### Scenario: 清除省份选择
- **WHEN** 用户点击"清除选择"选项
- **THEN** 系统 SHALL 调用后端 reclassify 命令，传入 lat=0.0, lng=0.0 表示不应用地理过滤

#### Scenario: 无分组数据时禁用
- **WHEN** 当前没有已处理的分组数据
- **THEN** 省份选择器按钮 SHALL 为禁用状态
