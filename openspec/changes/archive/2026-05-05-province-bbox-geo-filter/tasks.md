## 1. 前端 Province 数据结构扩展

- [x] 1.1 更新 `src/data/provinces.ts` 的 Province 接口，新增 minLat, maxLat, minLng, maxLng 字段
- [x] 1.2 为 34 个省级行政区补充边界框数据（minLat, maxLat, minLng, maxLng）

## 2. 后端 geo_filter 多网格查询

- [x] 2.1 在 `src-tauri/src/core/geo_filter.rs` 新增 `query_local_species_in_bbox` 函数，遍历边界框内所有网格取物种并集
- [x] 2.2 为 `query_local_species_in_bbox` 编写单元测试（正常查询、空边界框、无数据区域）

## 3. 后端 IPC 接口变更

- [x] 3.1 修改 `reclassify` 命令签名，从 `(lat, lng)` 改为 `(min_lat, max_lat, min_lng, max_lng)`，内部调用 `query_local_species_in_bbox`
- [x] 3.2 修改 `process_folder` 命令的 GPS 参数，从 `(lat, lng)` 改为边界框参数，适配 `query_local_species_in_bbox`
- [x] 3.3 更新 `bird_classification.rs` 中 `classify_detections` 和 `classify_group_with_fusion` 的 GPS 参数类型，支持边界框
- [x] 3.4 更新相关测试用例

## 4. 前端 IPC 适配

- [x] 4.1 更新 `src/services/processService.ts` 的 `reclassify` 和 `processFolder` 接口签名，传递边界框参数
- [x] 4.2 更新 `src/components/panels/TopNavBar.tsx` 中 `handleSelectProvince`，从 province 对象提取边界框参数传给 reclassify
- [x] 4.3 更新 `src/hooks/useProcessing.ts` 中 processFolder 调用，传递边界框参数

## 5. 持久化兼容

- [x] 5.1 更新 `src/stores/settingsStorage.ts` 的 `isValidProvince` 校验，支持带边界框的新格式
- [x] 5.2 添加旧版 Province 数据的兼容逻辑：缺少边界框字段时用省会坐标推算默认值（lat±2, lng±2）

## 6. 验证

- [x] 6.1 运行 `cd src-tauri && cargo test` 确认 Rust 测试通过
- [x] 6.2 运行 `npx vitest run` 确认前端测试通过
- [x] 6.3 运行 `npm run build` 确认 TypeScript 编译通过
