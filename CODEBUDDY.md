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

- **画布渲染** (PixiJS v8):
  - `InfiniteCanvas.tsx` — 主画布，管理 PixiJS Application 生命周期
    - 层级: Stage → BackgroundLayer(固定) + ContentLayer(缩放/平移)
    - 虚拟化: `getVisibleItems()` 二分查找 + `diffVisibleItems()` 增量更新
    - 初始化 effect 依赖 `[layout, updateViewport, ...]`，layout 变化会重建整个 Application
  - `CanvasImageItem.ts` — 单张图片容器(sprite + placeholder + overlay)
  - `useImageLoader.ts` — TextureLRUCache (300条目, 300MB 上限)
    - **禁止手动销毁纹理**: 不调用 `texture.destroy()` 或 `Assets.unload()`，由 PixiJS GCSystem 自动回收
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

- InfiniteCanvas 的初始化 useEffect 是**异步**的（`initApp()` 不被 await），用 `destroyed` 标志防止竞态
- EXIF orientation 5,6,7,8 表示 ±90° 旋转，后端自动交换 width/height，前端再做视觉旋转
- 前端测试 mock: 需要 mock `pixi.js` 的 `Assets` 和 Tauri 的 `invoke()`
- Rust 测试: 内联 `#[cfg(test)]` 模块，`cargo test` 即可运行

## PixiJS 纹理生命周期（重要）

**核心原则：不要手动销毁通过 `Assets.load()` 加载的纹理。**

- `Assets.load(url)` 创建的纹理由 PixiJS Assets 系统内部管理（Cache + Loader + TextureSource）
- `texture.destroy(true)` 和 `Assets.unload(url)` 都会将 `TextureSource._style` 置为 `null`
- PixiJS 渲染管线（Batcher → GlTextureSystem）持有 TextureSource 的深层引用，无法从外部保证所有引用已清除
- 任何时机的手动 destroy 都可能导致 `Cannot read properties of null (reading 'alphaMode'/'addressModeU')` 崩溃

**正确做法：**
- LRU 缓存只管理引用（增删条目），淘汰时不触碰纹理对象
- PixiJS GCSystem 自动回收无引用纹理的 GPU 资源（调用 `source.unload()` 而非 `source.destroy()`）
- 替换或销毁 Sprite 前先设置 `sprite.texture = Texture.EMPTY`，断开 BatchableSprite 对纹理的引用
