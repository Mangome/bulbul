## Why

照片没有 GPS 信息时，鸟种分类器在 10,964 种全球鸟类中搜索，容易产生误识别（例如将中国不存在的南美鸟种标记为高置信度结果）。现有的地理过滤（`geo_filter`）依赖 EXIF GPS 坐标，但大部分 RAW 照片（尤其是国内拍鸟场景）不携带 GPS 数据，导致该过滤功能形同虚设。用户需要一个手动指定拍摄地区的方式来启用地理过滤。

## What Changes

- 新增省份选择器 UI 组件，嵌入 TopNavBar 工具栏，用户可从 34 个省级行政区中选择
- 新增前端 `useGeoStore` 管理选中的省份状态，持久化到 settings.json
- 新增后端 `reclassify` IPC 命令，使用指定 GPS 坐标重新执行鸟种分类（复用已有检测结果，不重跑检测）
- 后端 `SessionState` 新增 `detection_cache` 字段，缓存检测结果以支持重分类
- 省份选择仅对无 EXIF GPS 的照片生效，有 GPS 的照片保持原有精确坐标

## Capabilities

### New Capabilities
- `province-geo-selector`: 省份选择器 UI 组件和前端状态管理，包括省份列表数据、下拉选择器交互、useGeoStore 持久化
- `reclassify-command`: 后端 reclassify IPC 命令，接收 GPS 坐标后对无 GPS 照片重跑分类，流式更新前端

### Modified Capabilities
- `session-state`: 新增 detection_cache 字段缓存检测结果，供 reclassify 命令读取
- `global-species-classifier`: 分类流程增加"手动 GPS override"路径，当照片无 EXIF GPS 时使用用户选定的省份坐标

## Impact

- **前端**: TopNavBar 组件新增省份选择器；新增 useGeoStore；processService 新增 reclassify 调用；settingsStorage 新增 province 持久化
- **后端**: process_commands.rs 新增 reclassify 命令；session.rs 新增 detection_cache 字段；lib.rs 注册新命令
- **数据**: 新增 `src/data/provinces.ts`（34 省份坐标静态数据）
- **IPC**: 新增 `reclassify` 命令签名 `(lat: f64, lng: f64) -> Result<(), String>`
- **无破坏性变更**: 所有新功能为增量添加，不影响现有 GPS 过滤逻辑
