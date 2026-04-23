## 1. 数据准备

- [x] 1.1 编写 `scripts/build_species_grid.py`：从 `avonet.db` 预计算 1° 网格，生成 `species_grid_1deg.json.gz`
- [x] 1.2 运行脚本生成 `src-tauri/resources/models/species_grid_1deg.json.gz`，验证文件大小（约 2MB gzip）
- [x] 1.3 验证网格数据正确性：北京(39.9, 116.4) 查询返回约 170 个物种，与精确查询 163 个的差值 <20

## 2. Rust 依赖与模块结构

- [x] 2.1 在 `Cargo.toml` 添加 `flate2` 依赖（若尚未包含）
- [x] 2.2 在 `src-tauri/src/core/mod.rs` 注册 `geo_filter` 模块

## 3. geo_filter 模块实现

- [x] 3.1 实现 `load_grid_data(grid_path: &Path) -> Result<HashMap<String, Vec<u16>>>`：读取 gzip JSON，反序列化，缓存到 `lazy_static`
- [x] 3.2 实现 `query_local_species(lat: f64, lng: f64) -> Option<Vec<u16>>`：将经纬度转为网格 key，查找缓存
- [x] 3.3 实现 `apply_geo_filter(probs: &mut [f32], local_species: &[u16])`：mask + 重新归一化
- [x] 3.4 处理边界情况：空 local_species 不过滤、所有概率被 mask 时保留原结果、网格数据加载失败返回 None
- [x] 3.5 编写单元测试：query_local_species、apply_geo_filter、边界条件

## 4. bird_classification 模块修改

- [x] 4.1 `classify_crop_with_probs()` 增加 `gps: Option<(f64, f64)>` 参数，softmax 后调用 geo_filter
- [x] 4.2 `classify_detections()` 增加 `gps: Option<(f64, f64)>` 参数，透传到 `classify_crop_with_probs()`
- [x] 4.3 `classify_group_with_fusion()` 增加 `gps: Option<(f64, f64)>` 参数，融合后应用地理过滤
- [x] 4.4 更新 `get_classifier_paths()` 或新增 `get_geo_grid_path()` 解析网格数据路径
- [x] 4.5 更新现有单元测试的函数调用签名

## 5. process_commands 集成

- [x] 5.1 在 FocusScoring 阶段的 `spawn_blocking` 闭包中，从 `SessionState.metadata_cache` 提取 GPS 坐标
- [x] 5.2 将 GPS 坐标传入 `classify_detections()` 调用
- [x] 5.3 将 GPS 坐标传入 `classify_group_with_fusion()` 调用
- [x] 5.4 处理 GPS 不可达的情况：metadata_cache 在 Mutex 中需在 spawn_blocking 前提取 GPS

## 6. 构建与资源配置

- [x] 6.1 确认 `species_grid_1deg.json.gz` 在 Tauri `tauri.conf.json` 的 resources 配置中
- [x] 6.2 验证 `resolve_path()` 在开发和发布模式下均可找到网格文件
- [ ] 6.3 运行 `npm run tauri dev` 确认应用正常启动，无加载错误

## 7. 端到端验证

- [ ] 7.1 准备带 GPS 的 NEF 测试文件，验证分类结果应用了地理过滤
- [ ] 7.2 准备无 GPS 的 NEF 测试文件，验证分类结果无变化
- [x] 7.3 运行 `npx vitest run` 确认前端测试通过
- [x] 7.4 运行 `cd src-tauri && cargo test` 确认 Rust 测试通过
