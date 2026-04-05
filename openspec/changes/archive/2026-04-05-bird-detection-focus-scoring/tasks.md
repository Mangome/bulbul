## 1. 后端依赖与模型集成

- [x] 1.1 添加 `ort` crate 到 Cargo.toml，版本 1.18+
- [x] 1.2 添加 `lazy_static` crate 到 Cargo.toml
- [x] 1.3 下载 YOLOv8s.onnx 预训练模型，验证 SHA256 校验和
- [x] 1.4 将模型文件放入 src-tauri/resources/models/yolov8s.onnx
- [x] 1.5 配置 Tauri build 脚本，编译时将模型复制到分发目录
- [x] 1.6 测试模型文件在打包的安装包中可正确加载

## 2. 核心检测模块实现

- [x] 2.1 创建 src-tauri/src/core/bird_detection.rs 模块
- [x] 2.2 实现 `DetectionBox` 和 `DetectionResult` 结构体（可序列化）
- [x] 2.3 实现 letterbox 等比缩放函数（640×640，保持宽高比）
- [x] 2.4 实现 YOLOv8s 推理函数（加载模型、准备输入张量、调用 ort Session）
- [x] 2.5 实现 NMS 非极大值抑制（IoU 阈值 0.45）
- [x] 2.6 实现置信度过滤（< 0.25 的框移除）
- [x] 2.7 实现坐标反归一化（从 640px 回到原始图片，考虑 padding）
- [x] 2.8 实现模型文件缓存加载（首次加载到内存，后续复用）
- [x] 2.9 单测：letterbox 宽图（800×600 → 640×480 + 上下 padding 80）
- [x] 2.10 单测：letterbox 高图（600×800 → 480×640 + 左右 padding 80）
- [x] 2.11 单测：letterbox 正方形（640×640 不变，无 padding）
- [x] 2.12 单测：letterbox 极端比例（2000×200 → 640×64 + 大量 padding）
- [x] 2.13 单测：NMS 高重叠框合并（IoU > 0.45 时保留高置信度框，移除低的）
- [x] 2.14 单测：NMS 独立框全部保留（IoU < 0.45 时两框都保留）
- [x] 2.15 单测：NMS 空输入返回空
- [x] 2.16 单测：NMS 单框直接返回
- [x] 2.17 单测：置信度过滤——0.75 保留、0.15 移除、恰好 0.25 保留（边界值）
- [x] 2.18 单测：置信度过滤全部低于阈值返回空
- [x] 2.19 单测：坐标反归一化——宽图 letterbox 后的检测框正确映射回原始图片相对坐标
- [x] 2.20 单测：坐标反归一化——高图 letterbox 后的检测框正确映射回原始图片相对坐标
- [x] 2.21 单测：坐标反归一化——输出坐标范围 [0, 1]，超出范围 clamp
- [x] 2.22 单测：IoU 计算——完全重叠返回 1.0、完全不重叠返回 0.0、部分重叠返回正确值

## 3. 合焦评分改造

- [x] 3.1 在 focus_score.rs 中添加 `FocusScoringMethod` 枚举定义
- [x] 3.2 实现 `evaluate_blocks_in_bbox()` 函数（在检测框内计算 Laplacian 方差）
- [x] 3.3 修改 `calculate_focus_score()` 签名，新增可选参数 `bbox: Option<&DetectionBox>`
- [x] 3.4 实现条件逻辑：有框时使用 `evaluate_blocks_in_bbox()`，无框时返回 None 和 Undetected
- [x] 3.5 更新错误处理和 AppError，新增 DetectionFailed 变体（如需）
- [x] 3.6 单测：bbox 覆盖全图时评分与旧全画面算法结果一致
- [x] 3.7 单测：bbox 覆盖锐利区域（棋盘纹理）得分 >= 4
- [x] 3.8 单测：bbox 覆盖模糊区域（纯色）得分 <= 2
- [x] 3.9 单测：bbox 为 None 时返回 score=None, method=Undetected
- [x] 3.10 单测：bbox 极小区域（< 10px²）不 panic，返回合理评分或 fallback
- [x] 3.11 单测：bbox 坐标越界（x2 > 1.0）时 clamp 到有效范围
- [x] 3.12 单测：FocusScoringMethod 枚举序列化——BirdRegion → "BirdRegion"、Undetected → "Undetected"

## 4. 数据模型扩展

- [x] 4.1 在 src-tauri/src/models/image_metadata.rs 中添加 `detection_bboxes: Vec<DetectionBox>` 字段
- [x] 4.2 添加 `focus_score_method: Option<FocusScoringMethod>` 字段
- [x] 4.3 实现 serde 序列化/反序列化（注意 snake_case 自动转 camelCase）
- [x] 4.4 在 ProcessingState 枚举中新增 `FocusScoring` 变体
- [x] 4.5 更新 SessionState 以支持新字段
- [x] 4.6 编写迁移逻辑，确保旧数据向后兼容（无新字段时默认值）
- [x] 4.7 单测：旧 JSON（无 detectionBboxes/focusScoringMethod）反序列化成功，新字段取默认值
- [x] 4.8 单测：新 JSON 含完整字段时反序列化正确
- [x] 4.9 单测：DetectionBox 序列化/反序列化往返一致（round-trip）
- [x] 4.10 单测：ImageMetadata 含空 detection_bboxes 时序列化为 `[]`

## 5. 处理流水线集成

- [x] 5.1 修改 src-tauri/src/commands/process_commands.rs，在 Grouping 完成后启动 FocusScoring 后台任务
- [x] 5.2 实现后台任务函数 `compute_focus_scores_background()`（使用 Semaphore 限制并发 ≤ 4）
- [x] 5.3 在后台任务中串行执行：检测 → 合焦评分 → 缓存更新
- [x] 5.4 实现 `focus-score-update` IPC 事件，每张完成后 emit（hash, score, method）
- [x] 5.5 实现取消支持（检查 cancel_flag，停止启动新任务但等待已启动任务完成）
- [x] 5.6 实现 SessionState.metadata_cache 的并发安全更新（使用 Mutex/RwLock）
- [x] 5.7 单测：cancel_flag 生效时不启动新检测任务，已启动任务正常完成
- [x] 5.8 单测：metadata_cache 并发写入不 panic（多线程同时更新不同 hash）
- [x] 5.9 单测：focus-score-update 事件 payload 格式正确（hash、score、method 字段完整）


## 6. 前端类型定义与通信

- [x] 6.1 在 src/types/index.ts 中添加 `DetectionBox` 接口（camelCase 字段名）
- [x] 6.2 添加 `FocusScoringMethod` 类型（字符串字面量联合）
- [x] 6.3 扩展 `ImageMetadata` 接口，新增 `detectionBboxes` 和 `focusScoringMethod` 字段
- [x] 6.4 更新 `ProcessingProgress` 类型，支持 `focus-score-update` 事件（如需）
- [x] 6.5 更新 `ProcessingState` 类型，新增 `"focus_scoring"` 字符串字面量
- [x] 6.6 验证 TypeScript 编译无类型错误

## 7. 检测框可视化组件

- [x] 7.1 创建 src/components/DetectionOverlay.tsx React 组件
- [x] 7.2 实现 Pixi Graphics 绘制逻辑（绿色主框、黄色副框、折角）
- [x] 7.3 实现坐标映射（相对坐标 [0, 1] → 画布像素坐标，考虑缩放）
- [x] 7.4 实现置信度标签绘制（"Bird: XX%"，位置自动调整避免重叠）
- [x] 7.5 实现 hover 触发和离开的显示/隐藏逻辑
- [x] 7.6 实现 Graphics 缓存优化（避免每次 hover 重新绘制）
- [x] 7.7 单测：坐标映射——相对坐标 (0.2, 0.1, 0.8, 0.9) + 显示尺寸 400×300 → 像素 (80, 30, 320, 270)
- [x] 7.8 单测：坐标映射——相对坐标 (0, 0, 1, 1) 全图框映射到完整显示区域
- [x] 7.9 单测：空 bboxes 数组时不绘制任何 Graphics 对象

## 8. FocusScore UI 组件改造

- [x] 8.1 修改 src/components/FocusScore.tsx，新增 hover 事件处理
- [x] 8.2 实现"未检测到主体"的灰色标记显示（focus_score_method = Undetected）
- [x] 8.3 在 hover 时调用 DetectionOverlay 绘制框（传入 detectionBboxes）
- [x] 8.4 实现星级评分的条件渲染（无评分时显示 N/A 或图标）
- [x] 8.5 单测：method=Undetected 时渲染"未检测到主体"文本，不渲染星级
- [x] 8.6 单测：method=BirdRegion + score=4 时正常渲染 4 星
- [x] 8.7 单测：method=FullImage（旧数据）时正常渲染星级（向后兼容）

## 9. 测试与标定

- [x] 9.1 编写集成测试：选择包含多张鸟类照片的文件夹，运行完整流水线
- [x] 9.2 验证后台 FocusScoring 正确执行（监听 `focus-score-update` 事件）
- [x] 9.3 验证检测框在 UI 上正确绘制（多只鸟场景）
- [x] 9.4 用 500+ 真实照片计算 Laplacian 方差分布，生成直方图
- [x] 9.5 根据分布调整方差阈值映射（如需）
- [x] 9.6 性能基准测试：CPU i7/Ryzen 7 上的推理延迟，低端硬件的容限

## 10. 文档与打包

- [x] 10.1 更新 README.md，说明新增的鸟类检测功能和方差阈值标定计划
- [x] 10.2 更新变更日志 CHANGELOG.md
- [x] 10.3 验证安装包体积增长（预期 +26MB）
- [x] 10.4 编写 CI/CD 验证脚本（模型文件校验、跨平台编译）
- [x] 10.5 测试所有支持的操作系统（Windows、macOS、Linux）

## 11. 部署与回滚

- [x] 11.1 创建特性分支并提交 PR（包含所有 spec、design、code）
- [x] 11.2 进行 code review（重点：并发安全、推理正确性、边界情况）
- [x] 11.3 通过 CI 所有测试（单元测试、集成测试、跨平台编译）
- [x] 11.4 合并到 main，发布新版本
- [x] 11.5 监控首周用户反馈（漏检率、性能问题）
- [x] 11.6 如发现严重问题，准备回滚方案（禁用检测、回到全画面评分）
