## Purpose

物种地理分布过滤能力：根据 GPS 坐标查询当地可能出现的物种列表，对分类概率向量进行地理过滤，提升鸟种识别精度。

## Requirements

### Requirement: 物种地理分布网格数据加载

系统 SHALL 在首次使用地理过滤时从 `species_grid_1deg.json.gz` 加载预计算的 1° 网格物种分布数据到内存缓存，后续复用缓存。网格格式为 `{"lat_idx,lng_idx": [cls0, cls1, ...]}`，其中 lat_idx 和 lng_idx 为整度数，cls 为模型输出索引（0-indexed）。

#### Scenario: 首次过滤时加载数据

- **WHEN** 系统首次调用地理过滤函数
- **THEN** 从资源目录读取 `species_grid_1deg.json.gz`，解压并反序列化为 `HashMap<String, Vec<u16>>`，缓存在全局静态变量中

#### Scenario: 后续过滤使用缓存

- **WHEN** 系统第二次调用地理过滤函数
- **THEN** 使用内存缓存的网格数据，无需重新读取文件

#### Scenario: 数据文件不存在时降级

- **WHEN** `species_grid_1deg.json.gz` 文件不存在
- **THEN** log warn 并返回 None，分类不应用地理过滤（降级为全量搜索）

### Requirement: GPS 坐标查询当地物种列表

系统 SHALL 提供 `query_local_species(lat: f64, lng: f64) -> Option<Vec<u16>>` 函数，根据 GPS 坐标在 1° 网格中查询该位置可能出现的物种 cls 索引列表。

#### Scenario: 北京坐标查询

- **WHEN** 输入 lat=39.9, lng=116.4
- **THEN** 查找 key="39,116"，返回该网格单元内的物种 cls 列表（约 170 个物种）

#### Scenario: 海洋坐标查询

- **WHEN** 输入坐标在海洋区域（无网格数据）
- **THEN** 返回 None，表示该位置无分布数据

#### Scenario: 负数经纬度

- **WHEN** 输入 lat=-33.9, lng=151.2（悉尼）
- **THEN** 查找 key="-34,151"，正确返回该区域的物种列表

#### Scenario: 边界坐标

- **WHEN** 输入 lat=40.0, lng=116.0（恰好在整数度上）
- **THEN** 查找 key="40,116"，返回该网格单元的物种列表

### Requirement: 概率向量地理过滤

系统 SHALL 提供 `apply_geo_filter(probs: &mut [f32], local_species: &[u16])` 函数，将概率向量中不在 local_species 列表中的物种概率置零，再重新归一化使概率和为 1.0。

#### Scenario: 正常过滤

- **WHEN** 概率向量有 10,964 维，local_species 包含 170 个 cls 索引
- **THEN** 不在 local_species 中的 10,794 个位置概率置零，保留的 170 个位置按原比例重新归一化

#### Scenario: 所有物种被过滤时保留原结果

- **WHEN** local_species 非空但概率向量中所有非零概率对应的 cls 均不在 local_species 中
- **THEN** 不修改概率向量（保留原始结果），log debug 提示

#### Scenario: 空物种列表不过滤

- **WHEN** local_species 为空
- **THEN** 不修改概率向量

### Requirement: 网格数据资源打包

`species_grid_1deg.json.gz` SHALL 作为 Tauri 资源文件打包到 `resources/models/` 目录下，随应用分发。构建脚本和 Tauri 配置 SHALL 确保该文件在开发和发布模式下均可正确访问。

#### Scenario: 开发模式路径

- **WHEN** 在开发模式下运行 `npm run tauri dev`
- **THEN** 网格数据从 `src-tauri/resources/models/species_grid_1deg.json.gz` 加载

#### Scenario: 发布模式路径

- **WHEN** 在已安装的应用中运行
- **THEN** 网格数据从 Tauri resource_dir 解析的路径加载
