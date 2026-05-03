## 1. 后端数据模型与直方图计算

- [x] 1.1 在 `src-tauri/src/models/image_metadata.rs` 中新增 `histogram_r: Vec<u32>`、`histogram_g: Vec<u32>`、`histogram_b: Vec<u32>` 字段，添加 `#[serde(default)]` 和 `#[serde(rename_all = "camelCase")]` 兼容处理
- [x] 1.2 在 `src-tauri/src/core/raw_processor.rs` 的 `process_single_image` 中，`DynamicImage` 解码后、`generate_medium()` 之前，新增 RGB 直方图计算逻辑（遍历像素按通道计数）
- [x] 1.3 运行 `cargo check` 和 `cargo test` 验证后端编译和测试通过

## 2. 前端类型与状态管理

- [x] 2.1 在 `src/types/index.ts` 的 `ImageMetadata` 接口中新增 `histogramR: number[]`、`histogramG: number[]`、`histogramB: number[]` 字段
- [x] 2.2 在 `src/stores/useCanvasStore.ts` 中新增 `showImageInfo: boolean`（默认 true）和 `showHistogram: boolean`（默认 false）状态字段，以及 `toggleImageInfo` 和 `toggleHistogram` actions
- [x] 2.3 在设置持久化逻辑中（`useThemeStore` 或 settings.json 读写），将 `showImageInfo` 和 `showHistogram` 加入持久化字段，与 `showDetectionOverlay` 模式一致
- [x] 2.4 运行 `npx tsc --noEmit` 验证类型检查通过

## 3. CanvasImageItem 直方图绘制

- [x] 3.1 在 `CanvasImageItem` 中新增 `histogramR/G/B: number[] | null` 属性和 `setHistogram(r, g, b)` 方法
- [x] 3.2 新增 `_drawHistogram(ctx, zoom)` 私有方法：在图片底部渐变背景区域内绘制 RGB 叠加直方图，使用半透明红/绿/蓝填充，高度约 40 屏幕像素，使用 `invZoom` 反向缩放补偿
- [x] 3.3 修改 `_drawInfoOverlay` 方法：接受 `showImageInfo` 参数控制文字绘制，渐变背景高度自适应直方图和信息文字的可见性
- [x] 3.4 在 `draw()` 方法中整合直方图绘制：传入 `showHistogram` 和 `showImageInfo` 参数，调整绘制顺序（渐变背景 → 直方图 → 信息文字）

## 4. InfiniteCanvas 数据传递

- [x] 4.1 在 `InfiniteCanvas.tsx` 中，当 CanvasImageItem 创建或元数据加载时，从 `ImageMetadata` 提取直方图数据调用 `setHistogram()`
- [x] 4.2 在 `draw()` 调用时传入 `showHistogram` 和 `showImageInfo` 来自 useCanvasStore
- [x] 4.3 切换显隐时调用 `markDirty()` 触发重绘

## 5. 设置面板 UI

- [x] 5.1 在 `SettingsPanel.tsx` 外观设置区域新增"图片信息"toggle 行，绑定 `useCanvasStore.toggleImageInfo` 和 `showImageInfo`
- [x] 5.2 在外观设置区域新增"直方图"toggle 行，绑定 `useCanvasStore.toggleHistogram` 和 `showHistogram`
- [x] 5.3 验证 toggle 切换后画布即时响应（无需手动刷新）

## 6. 集成验证

- [x] 6.1 运行 `npx tsc --noEmit` 和 `cd src-tauri && cargo check` 全量编译检查
- [x] 6.2 运行前端测试 `npx vitest run` 和 Rust 测试 `cd src-tauri && cargo test`
- [ ] 6.3 手动验证：打开含 NEF 文件的目录，开启直方图开关确认直方图正确显示，切换图片信息和直方图开关确认即时响应，重启应用确认设置持久化
