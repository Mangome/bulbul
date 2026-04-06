# CODEBUDDY.md

This file provides guidance to CodeBuddy Code when working with code in this repository.

## 常用命令

```bash
npm run tauri dev                # 启动完整开发环境（Rust + React 热更新）
npm run tauri build              # 生产构建
npm run build                    # 仅前端构建（tsc + vite）
npx tsc --noEmit                 # TypeScript 类型检查
npx vitest run                   # 运行所有前端测试
npx vitest run src/hooks/useImageLoader.test.ts  # 运行单个测试
cd src-tauri && cargo check      # Rust 编译检查
cd src-tauri && cargo test       # 运行所有 Rust 测试
cd src-tauri && cargo test focus_score  # 运行指定模块测试
```

## 架构概览

Tauri 2 桌面应用：React 18 前端 + Rust 后端，通过 IPC (`invoke`) 通信。

### 前端 (`src/`)

- **状态管理**: Zustand stores (`src/stores/`)
  - `useAppStore` — 文件夹、分组数据、处理状态
  - `useCanvasStore` — 缩放(0.1-3.0)、视口位置、当前分组索引
  - `useSelectionStore` — 选中图片 hash 集合
  - `useThemeStore` — 亮/暗主题，同步到 `document.documentElement.dataset.theme`
  - 持久化: `$APPDATA/bulbul/settings.json`，500ms 防抖写入

- **画布渲染** (Canvas 2D):
  - `InfiniteCanvas.tsx` — 主画布，管理原生 HTMLCanvasElement 生命周期
    - 渲染驱动: dirty flag + requestAnimationFrame 按需渲染，静止时零 CPU
    - 坐标系: `ctx.save/translate/scale/restore`，offsetX/offsetY/actualZoom 状态变量
    - 虚拟化: `getVisibleItems()` 二分查找 + `diffVisibleItems()` 增量更新
    - DPR 处理: setupCanvas() 设置物理分辨率 + ctx.scale(dpr, dpr)
    - 事件: 标准 pointer/wheel/keydown 事件，手动坐标变换 + hitTest
  - `CanvasImageItem.ts` — 单张图片 Canvas 2D 绘制类（占位色块、EXIF 旋转、选中/悬停动画、信息覆盖层）
  - `DotBackground.ts` — OffscreenCanvas pattern 波点背景
  - `GroupTitle.ts` — Canvas 2D 分组标题 fillText
  - `useImageLoader.ts` — ImageBitmap LRU 缓存（20 条目，200MB 上限）
    - 释放策略: 淘汰时调用 `image.close()` 释放内存
    - 质量选择: `displayWidth > 200px` → medium，否则 thumbnail

- **布局**: `src/utils/layout.ts` — `computeHorizontalLayout(groups, dims, viewportWidth)`
  - 单图分组: 1列全宽；多图分组: 2列平分

### 后端 (`src-tauri/src/`)

- **IPC 命令** (`commands/`): `process_folder`, `get_image_url`, `get_metadata`, `export_images`

- **6 阶段处理管线** (`commands/process_commands.rs`):
  1. 扫描 .nef 文件
  2. 并行处理(2×CPU): 提取嵌入 JPEG + 解析 EXIF + 生成缩略图
  3. 计算 pHash 感知哈希
  4. 相似度+时间间隔分组
  5. 异步合焦评分(Laplacian 1-5星)
  6. 返回 GroupResult

- **核心算法** (`core/`):
  - `nef_parser.rs` — TIFF IFD 链遍历，提取最大嵌入 JPEG
  - `metadata.rs` — EXIF 解析(30+字段)，orientation 5-8 自动交换宽高
  - `phash.rs` — 灰度→9×8 Lanczos3→2D DCT-II→64-bit hash
  - `grouping.rs` — 按(拍摄时间, 文件名)排序后顺序扫描聚类
  - `focus_score.rs` — 缩放512px→Laplacian 3×3→5×4分块→Top-3方差中位数

- **会话状态** (`state/session.rs`): `SessionState` 包含 hash↔路径映射、metadata 缓存、phash 缓存、分组结果、取消标志(`Arc<AtomicBool>`)

- **磁盘缓存** (`utils/cache.rs`): `$CACHE_DIR/bulbul/` 下 `medium/` 和 `thumbnail/` 目录

## 关键注意事项

- InfiniteCanvas 使用 dirty flag + rAF 按需渲染，所有状态变化需调用 `markDirty()` 触发重绘
- EXIF orientation 5,6,7,8 表示 ±90° 旋转，后端自动交换 width/height，前端再做视觉旋转
- 前端测试 mock: 需要 mock Canvas 2D context、matchMedia、ResizeObserver 和 Tauri 的 `invoke()`
- Rust 测试: 内联 `#[cfg(test)]` 模块，`cargo test` 即可运行

## Canvas 2D 渲染架构

**渲染循环**:
1. `markDirty()` 标记脏，调度 rAF
2. `renderFrame()` 执行: 清空 → 背景色 → DotBackground → ctx.save/translate/scale → drawGroupTitles + item.draw() → ctx.restore
3. item.draw() 返回 boolean，如有动画进行中自动继续 rAF

**坐标系统**:
- 屏幕坐标 → 内容坐标: `contentX = (screenX - offsetX) / actualZoom`
- 缩放锚点: 鼠标 Y 轴位置保持不变

**ImageBitmap 生命周期**:
- ImageLRUCache 管理，淘汰时调用 `image.close()` 释放内存
- ImageBitmap 销毁后 `drawImage()` 为 no-op（无崩溃风险）
- CanvasImageItem.destroy() 仅置空引用，不调用 `image.close()`
