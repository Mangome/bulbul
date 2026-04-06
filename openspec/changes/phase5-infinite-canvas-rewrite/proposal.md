## Why

快速切换图片分组时持续出现 PixiJS 纹理生命周期竞态导致的崩溃。Phases 1-3 已完成，但 Phase 4 发现关键缺陷：**CanvasImageItem 已迁移到 Canvas 2D 但未被渲染**（对象存储在 Map，既未加入 PixiJS 舞台、也未调用 draw() 绘制），导致当前画布实际上是不可见的。Phase 5 需要完成 InfiniteCanvas 从 PixiJS 到 Canvas 2D 的完整迁移，彻底消除纹理管理的竞态问题，同时借此机会实现高性能的按需渲染机制。

## What Changes

- **Canvas 初始化与 DPR 处理**：用原生 HTMLCanvasElement 替代 PixiJS Application，统一处理设备像素比（DPR），支持多显示器 DPR 变化
- **渲染循环重构**：从 PixiJS Ticker（固定 60fps）改为 requestAnimationFrame + dirty flag 的按需渲染，静止时零消耗资源
- **事件系统迁移**：用标准 Canvas pointer/wheel/resize 事件替代 PixiJS 事件系统，保留所有现有交互逻辑（滚轮缩放、拖拽平移、选中、悬停）
- **图片绘制集成**：在渲染循环中为每个可见 CanvasImageItem 调用 `draw(ctx, zoom, now)` 方法
- **分组切换动画**：离屏 Canvas 预渲染 + 整体淡入淡出位移，优化高频切组性能
- **坐标变换系统**：统一屏幕坐标 ↔ 内容坐标的转换公式，支持缩放锚点和视口平移
- **删除 PixiJS 依赖**：移除 package.json 的 pixi.js 依赖，删除不再需要的辅助类（ImageInfoOverlay 逻辑已内联到 CanvasImageItem）

## Capabilities

### New Capabilities

- `canvas-2d-rendering-engine`: 原生 Canvas 2D 渲染引擎，替代 PixiJS 框架，支持 DPR 自适应、按需渲染驱动、事件系统
- `infinite-canvas-component`: React 组件管理 Canvas DOM、CanvasImageItem 池、分组切换动画、事件处理、视口虚拟化
- `canvas-2d-drawing-primitives`: Canvas 2D 绘制基础设施（颜色、渐变、圆角矩形、文字测量、阴影、图案）
- `group-transition-animation`: 分组切换离屏预渲染优化方案，支持平滑 400ms 动画、降级策略、尊重 prefers-reduced-motion

### Modified Capabilities

- `canvas-image-item`: 现有 CanvasImageItem 的集成，已有 Canvas 2D 绘制实现，需集成进 InfiniteCanvas 渲染循环
- `image-cache`: 由 useImageLoader 提供的 ImageBitmap LRU 缓存，保持当前实现不变，但需确保销毁时直接 `bitmap.close()` 无竞态
- `viewport-virtualization`: 现有虚拟化逻辑（getVisibleItems / diffVisibleItems）保持不变，但所有变换基于 offsetX/offsetY/actualZoom 而非 PixiJS contentLayer
- `selection-interaction`: 现有选中交互逻辑保持不变，集成进 Canvas 坐标变换和 CanvasImageItem 的 hitTest/setSelected
- `theme-system`: 现有主题系统保持不变，Canvas 背景色根据主题切换，DotBackground 更新主题
- `keyboard-shortcuts`: 现有快捷键（W/S 分组切换、Ctrl+A 全选、Q 取消等）保持不变，集成进 Canvas 事件处理

## Impact

- **前端渲染层全面重写**：InfiniteCanvas.tsx 近 1000 行重写，涉及事件处理、坐标变换、渲染循环、分组切换动画
- **删除 PixiJS 依赖**：package.json 移除 pixi.js ^8.17.1，app bundle 体积减少 ~300KB（gzip ~80KB）
- **清理辅助类**：删除 ImageInfoOverlay.ts（逻辑已内联），确保无 PixiJS 残留代码
- **保持向后兼容**：useImperativeHandle 接口不变，store API 不变，绝大多数工具函数（layout.ts、viewport.ts）不变
- **浏览器/Tauri 兼容性**：Canvas 2D API 兼容性极高；ImageBitmap 销毁后 drawImage 为 no-op（无崩溃风险）；requestAnimationFrame 标准实现
- **测试覆盖**：需更新 InfiniteCanvas 的 mocking 层（移除 PixiJS mock，添加 Canvas context mock），更新集成测试确保快速切组无崩溃

## 依赖与实施顺序

```
Phase 1: ImageCache 改造 (已完成)
    ↓ Phase 1 输出: ImageBitmap LRU 缓存
Phase 2: CanvasImageItem 重写 (已完成)
    ↓ Phase 2 输出: Canvas 2D draw() 方法
Phase 3: 波点背景 + 分组标题 (已完成)
    ↓ Phase 3 输出: Canvas-based DotBackground + drawGroupTitles()
Phase 4: 未开始（本次 Phase 5 前置）
    ├─ 部分代码存在但未集成（CanvasImageItem 对象不可见）
    ├─ 需补全缺失部分：
    │  ├─ DetectionOverlay 改造（需新建）
    │  └─ 确保 GroupTitle 正确集成
    ↓ Phase 4 输出: CanvasImageItem 在画布上可见
Phase 5: InfiniteCanvas 重写（本变更）
    ├─ 创建 Canvas 元素 + 上下文
    ├─ 实现渲染循环和 dirty flag 机制
    ├─ 迁移所有事件处理器
    ├─ 实现分组切换动画
    └─ 删除 PixiJS 依赖

可并行部分：
- Phase 4 (DetectionOverlay) 和 Phase 5 (InfiniteCanvas) 大部分可以同步推进
```
