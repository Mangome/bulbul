## Context

Bulbul 是一个 Tauri 2 桌面应用，用于管理和展示重复/相似 RAW 格式图片。当前画布使用 Canvas 2D 渲染引擎，每张图片由 `CanvasImageItem` 绘制，底部有信息覆盖层（文件名+拍摄参数）。前端使用 `ImageBitmap` 加载图片，无法直接访问像素数据。

后端处理管线在阶段 2（`raw_processor`）已将 NEF 解码为 `DynamicImage`，此时可零额外 IO 计算直方图。设置面板已有"外观设置"区域和 toggle 控件模式（检测框开关），可直接复用。

## Goals / Non-Goals

**Goals:**
- 后端在图片处理阶段计算 RGB 直方图（3×256 bins），存入 ImageMetadata 并缓存
- 前端 CanvasImageItem 在图片底部绘制 RGB 直方图，与信息覆盖层共用渐变背景区域
- 设置面板"外观设置"区新增两个 toggle：图片信息显隐、直方图显隐
- useCanvasStore 新增 `showImageInfo` 和 `showHistogram` 状态，持久化到 settings.json

**Non-Goals:**
- 不实现亮度直方图或 Luminance 直方图（仅 RGB 三通道）
- 不实现直方图的交互功能（如拖动色阶调整）
- 不在前端计算直方图（不在 OffscreenCanvas 上 getImageData）
- 不修改现有的 ImageBitmap 加载流程

## Decisions

### 1. 直方图计算位置：后端 `raw_processor` 阶段

**选择**: 在 Rust 侧 `raw_processor::process_single_image` 中计算直方图

**替代方案**: 前端通过 OffscreenCanvas + `getImageData` 提取像素计算

**理由**: 后端已有 `DynamicImage` 解码结果，直方图计算仅需遍历像素计数（~1-2ms/张），无需额外 IO。前端 ImageBitmap 是不透明句柄，无法访问像素数据，若在前端计算需额外 `drawImage` + `getImageData`，每张图 10-50ms 且需 ~26MB 临时内存。直方图数据仅 3KB/张（3×256 u32），传输和存储开销极小。

### 2. 直方图数据存储：扩展 ImageMetadata + 缓存

**选择**: 在 `ImageMetadata` 结构中新增 `histogram_r/g/b: Vec<u32>` 字段，随元数据一起缓存

**理由**: 与 `focusScore`、`detectionBboxes` 的模式一致。数据量小（3KB/张），可直接序列化进现有缓存。使用 `#[serde(default)]` 处理旧缓存兼容性。

### 3. 直方图绘制位置：嵌入底部信息覆盖层区域

**选择**: 直方图绘制在图片底部，与信息覆盖层共用渐变背景，位于文字上方

**理由**: 底部渐变区域已有半透明黑色背景，直方图在此区域内视觉自然。直方图使用与信息覆盖层相同的反向缩放补偿（`invZoom`），确保视觉大小恒定。当信息覆盖层和直方图同时显示时，渐变背景高度需自适应两者内容。

### 4. 直方图视觉设计：小型 RGB 叠加直方图

**选择**: 紧凑型三通道叠加直方图，高度约 40 屏幕像素，使用半透明红/绿/蓝填充

**理由**: 叠加式直方图节省空间，三通道同时可见。高度 40px 在缩略图底部不突兀，且足以辨别曝光分布。半透明颜色叠加区域自然混合，与 Lightroom 等专业工具风格一致。

### 5. 显隐控制：useCanvasStore 新增两个布尔状态 + 持久化

**选择**: `showImageInfo`（默认 true）和 `showHistogram`（默认 false）存入 useCanvasStore，通过 settings.json 持久化

**理由**: 与 `showDetectionOverlay` 模式完全一致。showHistogram 默认 false 避免对现有用户体验产生干扰。持久化确保用户设置跨会话保留。

## Risks / Trade-offs

- **[缓存兼容性]** 旧缓存无直方图字段 → 使用 `#[serde(default)]` 返回空数组，前端检测到空数组时不绘制直方图
- **[处理时间增加]** 每张图多 ~1-2ms 直方图计算 → 1000 张图约多 1-2s，在并行处理（2×CPU）下影响较小
- **[覆盖层高度增加]** 信息覆盖层 + 直方图同时显示时底部区域变高 → 渐变背景高度自适应计算，确保覆盖完整
- **[直方图数据精度]** 基于 medium 缩略图（最大 2560px）计算，非原始 NEF → 对于曝光评估精度足够，且与 Lightroom 缩略图直方图行为一致
