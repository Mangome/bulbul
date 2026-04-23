## Context

Bulbul 是一个 RAW 照片批量相似度分组应用，内置鸟类检测（YOLOv8s）和鸟种分类（ResNet34, 10,964 种全球鸟类）功能。分类流程中已实现基于 GPS 的地理过滤：从 EXIF 提取坐标，查询 `species_grid_1deg.json.gz`（1° 网格物种分布数据），将非本地物种概率置零。

**问题**：大部分拍鸟场景的 RAW 照片不携带 GPS 信息，导致地理过滤无法启用。10,964 种的搜索空间过大，容易将中国不存在的鸟种标记为高置信度结果。

**现有架构**：
- 后端 `geo_filter` 模块：`query_local_species(lat, lng)` → `apply_geo_filter(probs, local_species)`
- GPS 数据在 FocusScoring 后台阶段传入 `classify_detections()` 和 `classify_group_with_fusion()`
- 前端 TopNavBar 已有弹窗交互模式（分组参数弹窗），可复用
- SessionState 缓存了 metadata/phash，但未缓存检测结果

## Goals / Non-Goals

**Goals:**
- 用户可通过 TopNavBar 选择省份，对无 GPS 照片启用地理过滤
- 切换省份后仅重跑分类（复用检测结果），不重跑检测和评分
- 有 EXIF GPS 的照片保持原有精确坐标，省份仅作 fallback
- 省份选择持久化，重启应用自动恢复

**Non-Goals:**
- 不实现省份多边形边界精确覆盖（1° 网格精度下省会坐标已足够）
- 不实现地图选点或自由坐标输入
- 不修改检测和评分流程
- 不支持国外地区选择（暂定国内省份）

## Decisions

### D1: 使用省会坐标作为省份代表坐标

**选择**：每个省份使用省会城市的经纬度作为代表坐标，查询 `species_grid_1deg.json.gz` 中对应的一个 1° 网格。

**替代方案**：
- (a) 省份多边形 → 计算所有覆盖网格 → 合并物种列表：精度更高但实现复杂度显著增加，1° 网格本身约 111km 精度，省会偏差影响有限
- (b) 大省使用 2-4 个代表坐标：覆盖更全面，但增加 UI 复杂度

**理由**：1° 网格粒度较粗，同一省内相邻网格的物种列表差异不大，省会坐标已能过滤掉大量不可能出现的物种。

### D2: reclassify 命令复用检测结果，仅重跑分类

**选择**：后端新增 `reclassify` 命令，从 SessionState 的 `detection_cache` 读取已有检测框，仅重跑 `classify_detections` 和 `classify_group_with_fusion`。

**替代方案**：
- (a) 重跑整个 FocusScoring 阶段：简单但耗时（包含检测 + 评分）
- (b) 前端直接使用省份坐标替换 GPS 重新调用 process_folder：最简单但完全重跑，用户等待时间长

**理由**：检测（YOLOv8s）和评分（Laplacian）结果不受 GPS 影响，只有分类受地理过滤影响。复用检测结果可将重分类耗时从 ~200-500ms/张降至 ~50-150ms/张。

### D3: detection_cache 在 SessionState 中以 HashMap 存储

**选择**：`SessionState` 新增 `detection_cache: HashMap<String, DetectionCacheEntry>`，在 FocusScoring 每帧完成时写入。

**替代方案**：
- (a) 从前端回传检测结果：需要 IPC 序列化大量检测框数据，增加网络开销
- (b) 独立磁盘缓存：增加 I/O，没有必要（检测结果在内存中已有）

**理由**：检测结果已在后端内存中，只需持久化到 SessionState 即可，无需额外 I/O 或 IPC。

### D4: 省份选择器采用下拉列表 + 搜索过滤

**选择**：TopNavBar 新增省份按钮，点击弹出可搜索的下拉列表，与现有分组参数弹窗交互风格一致。

**理由**：34 个省份需要搜索过滤才能快速定位；下拉列表比级联选择器更简单直接。

## Risks / Trade-offs

- **[省份边缘精度]** → 大省（新疆、西藏）边缘地区可能遗漏物种。缓解：后续可升级为多网格合并方案，但当前 1° 网格精度下影响有限
- **[重分类耗时]** → 1000 张照片重跑分类约 50-150 秒。缓解：复用 `processing-progress` 事件流式更新进度；分类本身是并发的
- **[GPS 优先级]** → 需确保有 EXIF GPS 的照片不受省份选择影响。缓解：reclassify 命令中对每张照片判断 gps_cache，有 GPS 的保持原坐标
