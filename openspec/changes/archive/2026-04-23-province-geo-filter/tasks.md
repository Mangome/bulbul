## 1. 省份坐标数据

- [x] 1.1 创建 `src/data/provinces.ts`，定义 Province 类型和 PROVINCES 常量（34 个省级行政区，含省会经纬度）

## 2. 前端 Store

- [x] 2.1 创建 `src/stores/useGeoStore.ts`，定义 selectedProvince 状态和 setProvince action
- [x] 2.2 在 `src/stores/settingsStorage.ts` 中添加 province 字段的持久化读写
- [x] 2.3 在 `src/stores/initSettings.ts` 中添加 province 初始化逻辑

## 3. 后端 SessionState 扩展

- [x] 3.1 在 `src-tauri/src/models/` 中定义 DetectionCacheEntry 结构体（score, method, bboxes）
- [x] 3.2 在 `src-tauri/src/state/session.rs` 的 SessionState 中新增 detection_cache 字段
- [x] 3.3 在 SessionState::reset() 中清空 detection_cache
- [x] 3.4 在 `process_commands.rs` 的 compute_focus_scores_background 中，每帧完成后将结果写入 detection_cache

## 4. 后端 reclassify 命令

- [x] 4.1 在 `process_commands.rs` 中实现 reclassify 命令：读取 detection_cache，对无 EXIF GPS 的照片使用传入坐标重跑 classify_detections
- [x] 4.2 在 reclassify 中实现分组融合投票重跑（classify_group_with_fusion）
- [x] 4.3 reclassify 完成后写回 detection_cache 并流式 emit focus-score-update 事件
- [x] 4.4 在 `src-tauri/src/lib.rs` 中注册 reclassify 命令

## 5. 前端 IPC 服务

- [x] 5.1 在 `src/services/processService.ts` 中新增 reclassify 函数调用 invoke('reclassify', { lat, lng })

## 6. TopNavBar 省份选择器 UI

- [x] 6.1 在 TopNavBar 中添加省份选择器按钮（IconMap SVG 图标 + 文本标签）
- [x] 6.2 实现省份下拉弹窗组件（搜索框 + 34 省份列表 + 清除选择选项）
- [x] 6.3 选择省份后调用 reclassify IPC 命令，传入省份经纬度
- [x] 6.4 在 TopNavBar.module.css 中添加选择器样式
- [x] 6.5 无分组数据时禁用省份选择器按钮

## 7. 测试

- [x] 7.1 后端：reclassify 命令的单元测试（GPS 优先级、detection_cache 读写、空 cache 错误处理）
- [x] 7.2 后端：DetectionCacheEntry 序列化/反序列化测试
- [x] 7.3 前端：useGeoStore 测试（选择、清除、持久化恢复）
