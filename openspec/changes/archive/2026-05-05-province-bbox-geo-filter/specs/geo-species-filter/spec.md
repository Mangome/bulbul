## ADDED Requirements

### Requirement: 边界框范围物种查询
系统 SHALL 提供 `query_local_species_in_bbox(min_lat: f64, max_lat: f64, min_lng: f64, max_lng: f64, grid_path: &Path) -> Option<Vec<u16>>` 函数，查询给定经纬度边界框内所有 1° 网格单元的物种并集。

#### Scenario: 云南省边界框查询
- **WHEN** 输入 min_lat=21.0, max_lat=29.5, min_lng=97.5, max_lng=106.5
- **THEN** 遍历 lat=21..29, lng=97..106 的所有网格 key，将每个网格的物种 cls 列表合并为去重并集返回

#### Scenario: 边界框跨网格边界
- **WHEN** 输入 min_lat=39.4, max_lat=41.1（北京）
- **THEN** 遍历 lat=39..41 的网格行，包含边界整数度对应的网格

#### Scenario: 边界框内无网格数据
- **WHEN** 边界框区域内没有任何网格数据（如海洋区域）
- **THEN** 返回 None

#### Scenario: 空边界框
- **WHEN** min_lat=0, max_lat=0, min_lng=0, max_lng=0
- **THEN** 返回 None，表示不应用地理过滤

## MODIFIED Requirements

### Requirement: GPS 坐标查询当地物种列表
系统 SHALL 提供 `query_local_species(lat: f64, lng: f64, grid_path: &Path) -> Option<Vec<u16>>` 函数，根据 GPS 坐标在 1° 网格中查询该位置可能出现的物种 cls 索引列表。此函数 SHALL 继续保留用于默认 GPS 坐标（非省份选择）场景。

#### Scenario: 北京坐标查询
- **WHEN** 输入 lat=39.9, lng=116.4
- **THEN** 查找 key="39,116"，返回该网格单元内的物种 cls 列表

#### Scenario: 海洋坐标查询
- **WHEN** 输入坐标在海洋区域（无网格数据）
- **THEN** 返回 None，表示该位置无分布数据

#### Scenario: 负数经纬度
- **WHEN** 输入 lat=-33.9, lng=151.2（悉尼）
- **THEN** 查找 key="-34,151"，正确返回该区域的物种列表

#### Scenario: 边界坐标
- **WHEN** 输入 lat=40.0, lng=116.0（恰好在整数度上）
- **THEN** 查找 key="40,116"，返回该网格单元的物种列表
