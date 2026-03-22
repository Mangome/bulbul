## Context

Bulbul 前 3 个阶段已完成：项目骨架（Stage 1）、NEF 解析与缓存（Stage 2）、pHash 分组流水线（Stage 3）。当前 `process_folder` 命令可以返回完整的 `GroupResult` 数据到前端，但 `MainPage.tsx` 仅显示占位文本。

本阶段需要将分组结果可视化——引入 PixiJS v8 WebGL 引擎实现无限画布，支持千级别图片的高性能瀑布流浏览。

已有基础设施：
- `useCanvasStore` 已定义缩放/视口状态（未连接实际画布）
- `useSelectionStore` 已定义选中状态管理
- `imageService.ts` 已封装 `getImageUrl` / `getMetadata` / `getBatchMetadata` IPC 调用
- `commands/image_commands.rs` 已有骨架（需补充实现）
- `components/canvas/` 目录已创建但为空

## Goals / Non-Goals

**Goals:**
- 处理完成后，在主窗口展示所有分组图片的瀑布流布局
- 滚轮缩放（以鼠标锚点，10%~300%）和拖拽平移流畅无卡顿
- 仅加载视口内图片纹理，视口外自动卸载，GPU 内存 ≤300MB
- 每张图片底部显示文件名 + 拍摄参数信息覆盖层
- 波点底纹背景正常渲染且不受缩放影响
- 布局算法单元测试覆盖率 ≥ 85%

**Non-Goals:**
- 图片点击选中/悬停高亮交互（Stage 5）
- 悬浮分组列表面板（Stage 5）
- 底部控制栏（Stage 5）
- 键盘快捷键（Stage 5）
- 导出功能（Stage 5）
- 暗色主题（Stage 6）

## Decisions

### Decision 1: PixiJS v8 直接使用 vs @pixi/react 包装

**选择**: 直接使用 PixiJS v8 API，不使用 `@pixi/react`。

**理由**:
- 无限画布需要对 PixiJS 渲染循环、Stage 层级、事件系统做精细控制
- `@pixi/react` 的声明式封装会在虚拟化场景下造成不必要的 React reconciliation 开销
- 画布内容（Sprite / Container）的创建销毁由虚拟化引擎直接控制，绑定到 React 生命周期反而复杂
- HUD 层（悬浮面板、控制栏）仍用 React DOM，通过 CSS `position: fixed` 叠加在画布上方

**替代方案**: 使用 `@pixi/react` 声明式组件——被拒绝，因为千级 Sprite 的频繁 mount/unmount 会带来性能问题。

### Decision 2: 布局计算时机

**选择**: 分组数据到达后一次性全量计算布局坐标，存储到内存。

**理由**:
- 瀑布流需要已知所有图片的宽高比才能正确计算列分配
- 千级别图片的布局计算耗时 <10ms，无需懒计算
- 预计算后的 `LayoutItem[]` 数组可直接被视口裁剪引擎二分搜索

### Decision 3: 纹理管理策略

**选择**: 自实现 LRU 纹理缓存，容量上限 300 张。

**理由**:
- PixiJS 内建的纹理管理不感知视口语义，无法做"进入视口加载、离开视口卸载"
- LRU 淘汰确保最近浏览的纹理保留，避免频繁来回滚动时反复加载
- 分级加载：缩放 <50% 使用 thumbnail（200px），≥50% 使用 medium（~1080p）

### Decision 4: 视口裁剪实现

**选择**: 基于排序后的 Y 坐标数组做二分搜索，快速定位视口内元素。

**理由**:
- 瀑布流布局下，LayoutItem 按 Y 坐标粗略有序（列间交错但整体递增）
- 对 Y 维度做二分搜索可将视口裁剪从 O(n) 降低到 O(log n + visible)
- 缓冲区（buffer）设为视口高度的 50%，预加载即将滚入视口的图片

### Decision 5: InfiniteCanvas 组件架构

**选择**: 单一 React 组件管理 PixiJS Application 生命周期，内部不使用 React 管理 PixiJS 对象。

```
<InfiniteCanvas>          // React 组件
  ├── useRef<HTMLDivElement>  // 挂载点
  ├── useEffect → new Application()  // 初始化
  ├── BackgroundLayer (TilingSprite)  // 波点底纹
  └── ContentLayer (Container)        // 内容层，被缩放/平移
      └── [CanvasImageItem × N]      // 由虚拟化引擎管理
```

画布内所有 PixiJS 对象（Container、Sprite、Graphics）通过命令式 API 创建/销毁，不经过 React。

### Decision 6: 图片尺寸信息来源

**选择**: 从 `ImageMetadata.image_width` / `image_height` 获取图片原始尺寸，用于布局计算。

**理由**:
- Stage 2 已解析 Exif 并缓存 `ImageMetadata`，其中包含 `image_width/height`
- 无需额外加载图片来获取尺寸，直接从 `get_batch_metadata` 批量获取
- 对于缺失尺寸信息的图片，回退到默认 3:2 比例

## Risks / Trade-offs

- **[风险] PixiJS v8 与 Tauri WebView 兼容性** → 缓解：PixiJS v8 使用 WebGPU 优先、WebGL2 回退，Tauri WebView2 (Chromium) 完全支持
- **[风险] 千级别图片布局计算回退到 O(n²)** → 缓解：瀑布流算法本身是 O(n)，二分搜索视口裁剪 O(log n)
- **[风险] 缩略图 200px 在高缩放时模糊** → 缓解：分级加载，缩放 ≥50% 自动切换 medium 图
- **[权衡] 不使用 @pixi/react 丧失声明式便利** → 接受：性能优先，画布内容量大且频繁变动，命令式更可控
- **[权衡] 纹理 LRU 300 张上限可能在快速滚动时出现闪白** → 缓解：占位色块 + 异步加载，视觉上可接受
