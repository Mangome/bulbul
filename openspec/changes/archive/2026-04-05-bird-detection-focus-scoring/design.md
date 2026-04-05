## Context

Bulbul 是一个鸟类摄影图片管理和分组工具。当前处理流水线为 5 阶段：Scanning → Processing → Analyzing → Grouping → Completed。其中 Analyzing 阶段计算 pHash 相似度，Completed 后在后台异步计算合焦评分（FocusScoring 伪阶段，不阻塞返回）。

合焦评分现采用全画面 Laplacian 方差算法（长边下采样 512px，5×4 分块，Top-3 中位数），映射到 1-5 星。该方法不适合鸟类摄影：浅景深背景模糊仍被评为"清晰"，复杂背景中失焦鸟因纹理被误评为"对焦好"。

项目当前无 AI/ML 推理能力、无主体检测模型、无 AF 点 EXIF 解析。支持的相机品牌包括 Nikon、Canon、Sony、Fuji 等。

## Goals / Non-Goals

**Goals:**

1. 引入 YOLOv8s 目标检测，识别图片中的鸟（COCO 预训练，bird 类别）
2. 改造合焦评分算法，仅评估检测框内（鸟的主体区域）的 Laplacian 方差
3. 优雅降级：检测失败时标记"未检测到主体"，不给出虚假评分
4. 持久化检测框数据（bbox 相对坐标），前端 hover 时可视化标注
5. 在 Analyzing 阶段后新增 FocusScoring 后台阶段，使用 Semaphore 限制并发 ≤ 4
6. 兼容所有相机品牌（通用图像检测方案，无品牌 EXIF 依赖）

**Non-Goals:**

- 不支持视频合焦评分
- 不做鸟种识别（仅检测"鸟"这一类）
- 不支持多只鸟的单独评分（取置信度最高的一只）
- 不做 AF 点信息读取（选择了 ONNX 检测而非 MakerNote 解析）
- 不重新标定方差阈值（5-1200），使用现有映射，后续根据实际调整

## Decisions

### 决策 1：推理框架选择 → ONNX Runtime (`ort` crate)

**选项考虑：**
- ONNX Runtime (`ort`)：生态成熟，CPU/GPU 都支持，YOLO 兼容性最好，动态库 ~20-40MB ✓
- Tract (纯 Rust)：无外部依赖，但算子覆盖不全，部分模型不兼容 ✗
- Candle：HuggingFace 纯 Rust，偏 LLM 方向，检测模型支持弱 ✗

**决策：** 选 `ort`，理由是 YOLO 模型兼容性和生态支持最强，纯 Rust 方案的算子完整性风险较大。

### 决策 2：模型选择 → YOLOv8s (22MB)

**选项考虑：**
- YOLOv8n (6MB)：最轻，但鸟类检测准确度较低，易漏检小体型远景鸟 ✗
- YOLOv8s (22MB)：平衡精度和速度，COCO 鸟类检测足够准确 ✓
- YOLOv8m/l (>50MB)：过度工程，性能收益边际递减 ✗

**决策：** 选 YOLOv8s，理由是在合理的体积增量下达到可接受的精度。

### 决策 3：分发方式 → 打包进安装包

**选项考虑：**
- 打包进去 (~26MB 增量)：启动快，无网络依赖，用户体验好 ✓
- 首次运行时下载：减小初始安装包，但增加首次运行延迟和网络风险 ✗

**决策：** 打包进去。用户已接受体积增量，启动无阻碍更重要。

### 决策 4：计算时机 → 串行（先检测，后合焦）

**选项考虑：**
- 串行：检测出 bbox 后，重新在 bbox 内计算 Laplacian 方差，实现简洁，逻辑清晰 ✓
- 并行 + 修正：检测和合焦并行，检测结果出来后修正评分，用户快速看到初步反馈，但代码复杂 ✗

**决策：** 串行。实现简单，后台异步执行不阻塞主流程，用户不感知 50-150ms 额外耗时。

### 决策 5：检测失败处理 → 标记"未检测到主体"

**选项考虑：**
- 降级到加权中心（方案 A）：给出评分，但准确度下降，用户不知道是哪种评分方法 ✗
- 标记"未检测到主体"：诚实，清晰告知用户，允许用户决定是否信任评分 ✓
- 两者结合：降级评分 + 标记标签，但增加复杂性 ✗

**决策：** 纯标记，不给评分。理由是"未知优于虚假"，用户能明确知道该图片是否被正确评估。

### 决策 6：多框处理 → Top-1 置信度最高 + 所有框持久化

**选项考虑：**
- 只用置信度最高的框：假设主体唯一，实现简单 ✓
- 对所有鸟分别评分：支持群鸟，但 UI/存储复杂，需要多个 focus_score 字段 ✗

**决策：** Top-1 用于合焦评分，但所有框都存储在 `detection_bboxes` 数组，前端 hover 可视化全部框。理由是简化评分逻辑，同时保留完整检测信息供前端使用。

### 决策 7：数据模型扩展

新增字段在 `ImageMetadata`：
- `detection_bboxes: Vec<DetectionBox>`（每个框含 x1/y1/x2/y2 相对坐标 [0-1]、confidence）
- `focus_score_method: Option<FocusScoringMethod>`（枚举值：FullImage / BirdRegion / Undetected）

新增 ProcessingState：`FocusScoring`（后台阶段，对应现有伪阶段的显式化）

新增 IPC 事件：`focus-score-update` (hash, score, method)

## Risks / Trade-offs

| 风险 | 影响 | 缓解方案 |
|-----|------|--------|
| **模型精度不足** — 远景、遮挡严重的鸟漏检 | 有效样本数量减少（标记为 Undetected），用户信心下降 | 后续可微调模型或换更大模型；用户可手动标记失败案例做反馈 |
| **安装包体积翻倍** — 用户初始下载慢，磁盘占用增加 | 分发风险、用户侧磁盘压力 | 已明确通知用户，包含模型压缩和后续 CDN 加速的计划 |
| **CPU 推理延迟** — 50-150ms/张在低端硬件可能达 200-300ms | 后台异步缓解，但首次打开慢 | 内存缓存检测结果，重复调用同一图片时无需推理 |
| **ONNX Runtime 依赖** — 引入外部动态库，跨平台兼容性风险 | macOS/Linux 上可能有动态库链接问题 | `ort` 文档完善，已覆盖主流平台，CI 验证所有平台 |
| **方差阈值未重新标定** — 区域评分分布与全画面不同，现有映射（50/200/600/1200）可能不匹配 | 评分偏低或偏高，需事后调整 | 实现后用 500+ 真实照片快速标定，调整阈值为期 1-2 周 |
| **检测框视觉误导** — 用户可能依赖框的位置而非评分本身 | 如框位置错误，用户做出错误判断 | UI 清晰标注"仅作参考"，置信度过低时不绘制框 |

## Migration Plan

**Phase 1（实现，1-2 周）：**
1. 添加 `ort` 依赖，集成 YOLOv8s.onnx 模型文件
2. 实现 bird_detection.rs 模块（letterbox、推理、NMS、置信度过滤）
3. 改造 focus_score.rs，支持全画面 vs 区域两种评分模式
4. 扩展 ImageMetadata，新增 detection_bboxes 和 focus_score_method
5. 改造 process_commands.rs，在 Analyzing 后串行执行检测+合焦
6. 编写单元测试（YOLOv8s 推理、NMS、bbox 计算、降级逻辑）

**Phase 2（前端，1 周）：**
1. 更新 TypeScript 类型定义（DetectionBox、FocusScoringMethod）
2. 实现 Detection Overlay 组件（hover 时绘制框）
3. 修改 FocusScore UI 组件，展示 scoring method 标记（"未检测到主体"等）

**Phase 3（标定和优化，1 周）：**
1. 用 500+ 真实鸟类照片测试，计算 Laplacian 方差分布
2. 如需要，调整方差阈值映射
3. 性能基准测试（平均推理延迟、并发情况）

**Rollback：**
- 若发现模型效果极差（>50% 漏检），暂时禁用检测，回到全画面评分（仅改 process_commands.rs 中的分支逻辑）
- 若 ONNX 跨平台问题严重，考虑改用 Tract（需重新训练模型或找兼容版本）

## Open Questions

1. **YOLOv8s ONNX 模型来源**——使用 Ultralytics 官方导出的 yolov8s.onnx，还是需要自己转换？→ 建议直接用官方版本（torch2onnx 已 release）
2. **模型文件路径**——打包进 assets/ 还是资源目录？→ 建议 src-tauri/resources/models/yolov8s.onnx，编译时复制到 dist
3. **Semaphore 并发数**——4 是否合适？→ 可根据测试调整，4 是保守估计
4. **前端 hover 绘制框的性能**——需要频繁重绘 Pixi Graphics？→ 缓存绘制结果，hover 时只改透明度/颜色
5. **方差阈值标定的测试集**——从项目中现有照片抽样，还是需要外部数据集？→ 用项目中现有的 500+ 真实 Nikon NEF，足够代表性
