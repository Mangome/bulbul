## Why

当前省份选择后仅使用省会城市坐标查询 1 个 1°×1° 网格单元的物种列表，而省份实际覆盖范围远大于单个网格（如云南跨约 8°×9° 共 72 个网格），导致大量本省有分布的鸟种被错误过滤掉，显著降低识别准确率。

## What Changes

- Province 数据结构新增 `minLat, maxLat, minLng, maxLng` 四个边界框字段，覆盖 34 个省级行政区的实际经纬度范围
- `geo_filter::query_local_species` 新增多网格查询函数，查询边界框内所有网格单元的物种并集
- 后端 `reclassify` 和 `process_folder` 命令改为接收边界框参数（minLat, maxLat, minLng, maxLng），替代单一的 lat/lng
- 前端 Province 接口和 IPC 调用适配边界框参数传递
- settings.json 持久化格式扩展，兼容旧版单点数据

## Capabilities

### New Capabilities

（无新增独立能力）

### Modified Capabilities

- `province-geo-selector`: Province 数据结构从单点坐标扩展为边界框，前端 IPC 接口传递边界框参数
- `geo-species-filter`: 新增多网格范围查询函数，支持边界框内的物种并集查询，替代单点查询

## Impact

- **前端数据**：`src/data/provinces.ts` Province 接口和 34 条数据更新
- **前端 Store**：`useGeoStore`、`settingsStorage`、`initSettings` 适配新接口
- **前端组件**：`TopNavBar.tsx` 中 reclassify 调用参数变更
- **前端 IPC**：`processService.ts` 的 `reclassify` 和 `processFolder` 接口签名变更
- **后端命令**：`process_commands.rs` 的 `reclassify` 和 `process_folder` 命令参数变更
- **后端核心**：`geo_filter.rs` 新增 `query_local_species_in_bbox` 函数
- **后端分类**：`bird_classification.rs` 调用侧适配
- **兼容性**：settings.json 需兼容旧版 Province 格式（缺少边界框字段时回退到单点坐标）
