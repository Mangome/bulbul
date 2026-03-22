## 1. 路径工具（utils/paths.rs）

- [x] 1.1 实现 `canonicalize_path` 函数：接受文件路径，返回规范化绝对路径（消除 `..`、`.`、符号链接）
- [x] 1.2 实现 `compute_path_hash` 函数：规范化路径后计算 MD5 哈希，返回 32 字符十六进制小写字符串
- [x] 1.3 实现 `get_cache_base_dir` 函数：根据传入的 app_cache_dir 构建 `{cache_dir}/bulbul/` 基础路径
- [x] 1.4 实现 `get_cache_file_path` 函数：根据 hash 和类型（medium/thumbnail）构建完整缓存文件路径
- [x] 1.5 编写 `utils/paths.rs` 单元测试：路径规范化、MD5 确定性、不同路径不同哈希、缓存路径构建

## 2. 文件缓存系统（utils/cache.rs）

- [x] 2.1 实现 `ensure_cache_dirs` 函数：异步创建 `medium/` 和 `thumbnail/` 缓存子目录（递归 mkdir）
- [x] 2.2 实现 `is_cached` 函数：检查给定 hash 的 medium + thumbnail 文件是否同时存在
- [x] 2.3 实现 `write_medium` 函数：异步写入 JPEG 字节数据到 `medium/{hash}.jpg`
- [x] 2.4 实现 `write_thumbnail` 函数：异步写入缩略图字节数据到 `thumbnail/{hash}.jpg`
- [x] 2.5 编写 `utils/cache.rs` 单元测试：目录创建、缓存命中/未命中/部分命中判断、文件写入验证

## 3. NEF/TIFF 解析器（core/nef_parser.rs）

- [x] 3.1 实现 TIFF 头解析：字节序识别（II/MM）、魔数验证（42）、IFD0 偏移量读取
- [x] 3.2 实现 IFD Entry 解析：读取 tag、type、count、value/offset，处理不同数据类型
- [x] 3.3 实现 IFD 链遍历：从 IFD0 开始，通过 next IFD offset 迭代遍历所有 IFD，越界时安全终止
- [x] 3.4 实现 SubIFD 递归解析：识别 SubIFD 指针（tag 0x014A），递归进入子 IFD 链
- [x] 3.5 实现嵌入 JPEG 定位：在所有 IFD/SubIFD 中查找 JPEGInterchangeFormat（0x0201）+ JPEGInterchangeFormatLength（0x0202），收集所有 JPEG 候选
- [x] 3.6 实现嵌入 JPEG 提取：选择最大 JPEG 候选，验证 SOI 魔数（0xFFD8），提取 `Vec<u8>` 数据，处理偏移越界
- [x] 3.7 定义 `RawExtractor` trait：`supported_extensions()`、`extract_jpeg()`、`extract_metadata()` 方法，约束 `Send + Sync`
- [x] 3.8 实现 `NefExtractor` 结构体及 `RawExtractor` trait 实现
- [x] 3.9 实现格式分发函数：根据文件扩展名（大小写不敏感）选择对应的 `RawExtractor`
- [x] 3.10 编写 `core/nef_parser.rs` 单元测试：TIFF 头解析（大端/小端/无效/过短）、IFD 遍历、JPEG 魔数验证、越界处理、无嵌入 JPEG 错误

## 4. Exif 元数据解析（core/metadata.rs）

- [x] 4.1 实现 `parse_exif` 函数：使用 kamadak-exif 从字节数据中读取 Exif Reader
- [x] 4.2 实现 Exif 标签到 ImageMetadata 的映射：相机信息（Make/Model）、镜头信息（LensModel/FocalLength）、图像尺寸（Width/Height/Orientation）
- [x] 4.3 实现拍摄时间解析：DateTimeOriginal 优先，DateTime 后备，格式转换为 ISO 8601
- [x] 4.4 实现曝光参数解析：FNumber、ExposureTime、ISO、ExposureBias、MeteringMode、ExposureMode
- [x] 4.5 实现 GPS 坐标转换：度/分/秒 → 十进制度数，南纬/西经为负数
- [x] 4.6 实现闪光灯和白平衡解析：FlashFired、FlashMode、WhiteBalance、ColorSpace
- [x] 4.7 编写 `core/metadata.rs` 单元测试：完整 Exif 解析、部分缺失标签降级、时间格式转换、GPS 坐标精度、无 Exif 错误

## 5. RAW 处理器（core/raw_processor.rs）

- [x] 5.1 定义 `ProcessResult` 结构体：hash、filename、file_path、metadata、medium_path、thumbnail_path
- [x] 5.2 实现 `process_single_raw` 函数：读取文件 → 调用 extractor.extract_jpeg() → 调用 extractor.extract_metadata() → 保存 medium → 生成缩略图 → 保存 thumbnail
- [x] 5.3 实现缩略图生成逻辑：JPEG 解码 → image crate resize 到 200px 宽（Lanczos3，保持宽高比）→ JPEG 编码（quality=85），小于 200px 不放大
- [x] 5.4 实现缓存命中时的快速路径：跳过 JPEG 提取和缩略图生成，仅解析 Exif（如需要）
- [x] 5.5 编写 `core/raw_processor.rs` 单元测试：缩略图尺寸验证（横向/纵向/小图）、处理结果完整性、缓存命中跳过逻辑

## 6. SessionState 扩展（state/session.rs）

- [x] 6.1 添加 `cache_dir: PathBuf` 字段到 `SessionState`
- [x] 6.2 实现 `SessionState::with_cache_dir(cache_dir: PathBuf)` 构造方法
- [x] 6.3 实现 `SessionState::reset()` 方法：清空所有映射、重置状态和取消标志
- [x] 6.4 更新 `lib.rs` 中 SessionState 初始化：通过 Tauri 路径 API 获取 cache_dir 并传入
- [x] 6.5 编写 `state/session.rs` 扩展单元测试：with_cache_dir 初始化、reset 后状态验证

## 7. Commands 实现（commands/）

- [x] 7.1 实现 `process_folder` 命令：扫描 NEF → Semaphore(8) 并发处理 → 更新 SessionState 映射 → emit 进度事件 → 返回结果
- [x] 7.2 实现 `process_folder` 中的取消检测：每个文件处理前检查 cancel_flag，设置后停止新任务派发
- [x] 7.3 实现 `process_folder` 中的错误收集：单文件失败不中断流水线，收集并报告失败文件
- [x] 7.4 实现 `cancel_processing` 命令：设置 cancel_flag 为 true，更新 processing_state 为 Cancelling
- [x] 7.5 实现 `get_image_url` 命令：根据 hash 和 size 构建缓存文件路径，验证文件存在后返回
- [x] 7.6 实现 `get_metadata` 命令：从 SessionState.metadata_cache 查找并返回 ImageMetadata
- [x] 7.7 实现 `get_batch_metadata` 命令：批量查找，跳过不存在的 hash
- [x] 7.8 编写 Commands 单元测试：process_folder 状态流转、取消逻辑、get_image_url 路径构建、get_metadata 查找

## 8. 前端进度集成（src/windows/MainPage.tsx）

- [x] 8.1 在 MainPage 中接入 `processService.onProgress` 事件监听，更新 useAppStore 中的 processing 状态
- [x] 8.2 在 MainPage 中接入 `processService.onCompleted` 和 `processService.onFailed` 事件监听
- [x] 8.3 添加基础进度展示 UI：当前处理状态文本 + 进度百分比 + 当前文件名
- [x] 8.4 在文件夹选择后自动触发 `processService.processFolder()` 调用

## 9. 集成验证

- [x] 9.1 `cargo build` 编译通过
- [x] 9.2 `cargo test` 所有 Rust 单元测试通过，核心解析模块覆盖率 ≥ 85%
- [x] 9.3 端到端验证：选择包含 NEF 文件的文件夹 → 处理完成 → medium 和 thumbnail 缓存文件生成正确
- [x] 9.4 二次处理验证：重新处理同一文件夹时命中缓存、跳过解析
- [x] 9.5 前端进度展示：处理过程中 MainPage 正确显示进度信息
