## Context

Bulbul 是基于 Tauri + React + PixiJS 的 RAW 图像筛选工具。Phases 1-3 已完成后端处理和 CanvasImageItem Canvas 2D 实现，但 Phase 4 发现关键架构缺陷：**CanvasImageItem 对象已创建但未被渲染**——既未加入 PixiJS 舞台，也未在任何 Canvas 上绘制。这导致当前画布完全不可见。

**当前技术栈**：React 18 + Zustand 5 + PixiJS 8 + Vite 6 + TypeScript 5 + Tauri 2

**已有的可复用组件**：
- CanvasImageItem.ts (767 行)：Canvas 2D draw() 完整实现，支持 EXIF 旋转、选中动画、信息覆盖层、zoom 可见性控制
- DotBackground.ts：OffscreenCanvas pattern 波点背景
- drawGroupTitles()：Canvas 2D 分组标题函数
- useImageLoader.ts：ImageBitmap LRU 缓存（30 条目上限，内存估算完整）
- viewport.ts / layout.ts：现有虚拟化逻辑完全可复用

**约束**：
- 不引入功能回归，现有选中/切组/悬停交互必须完全保留
- Canvas 2D API 兼容性高（Tauri WebView 基于 Chromium），无跨浏览器风险
- ImageBitmap 销毁后 drawImage 为 no-op，无竞态崩溃风险

## Goals / Non-Goals

**Goals**：
- 完成 InfiniteCanvas 从 PixiJS 到 Canvas 2D 的完整迁移，使 CanvasImageItem 对象在 Canvas 上实际可见
- 实现高性能按需渲染循环（dirty flag + requestAnimationFrame），静止时零 CPU 消耗
- 保留所有现有交互（滚轮缩放、拖拽平移、选中/悬停、键盘快捷键、分组切换）
- 实现分组切换离屏预渲染优化，400ms 平滑动画且不阻塞主线程
- 彻底消除 PixiJS 纹理生命周期竞态，移除 pixi.js 依赖，减少 bundle ~300KB
- 支持 DPR（设备像素比）自适应，包括多显示器 DPR 变化监听

**Non-Goals**：
- 不改动 Rust 后端逻辑或数据模型
- 不修改 store API（useCanvasStore、useAppStore、useSelectionStore、useThemeStore）
- 不改变虚拟化算法（viewport.ts、layout.ts 保持不变）
- 不实现网格检测框（DetectionOverlay 归属 Phase 4）
- 不做国际化或多语言

## Decisions

### 1. 渲染驱动机制：Dirty Flag + RequestAnimationFrame

**选择**：Dirty flag 标志 + `requestAnimationFrame` 按需渲染  
**替代方案**：固定 60fps 连续渲染、手动触发重绘 Canvas、Zustand selector 订阅驱动

**理由**：
- Dirty flag 机制确保静止时完全停止渲染，长时间浏览无 CPU 消耗
- requestAnimationFrame 对齐浏览器刷新率（60/90/120fps），避免 vsync 撕裂
- 触发 markDirty() 的场景明确（滚轮、拖拽、切组、选中、纹理加载），易于调试
- 相比 Zustand 订阅驱动，减少中间状态更新和组件重渲染

**实现**：
```typescript
const dirtyRef = useRef(true);
const rafIdRef = useRef(0);

function markDirty() {
  if (dirtyRef.current) return;  // 避免重复调度
  dirtyRef.current = true;
  cancelAnimationFrame(rafIdRef.current);
  rafIdRef.current = requestAnimationFrame(renderFrame);
}

function renderFrame() {
  if (!dirtyRef.current) return;
  dirtyRef.current = false;
  // 执行完整绘制
}
```

### 2. Canvas 初始化与 DPR 处理

**选择**：在 useEffect 中显式计算 DPR 并应用 ctx.scale()，ResizeObserver 中重新初始化，添加 matchMedia 监听 DPR 变化

**替代方案**：仅在 ResizeObserver 中处理、忽略 DPR 处理、用 CSS transform 缩放 canvas

**理由**：
- ctx.scale(dpr, dpr) 是标准做法，高 DPR 屏幕能得到清晰渲染
- ResizeObserver 必需（容器大小变化），同时也处理 DPR 变化最简洁
- matchMedia('(resolution: ...).addListener()` 可检测多显示器间的 DPR 切换
- CSS transform 缩放会导致模糊和性能问题

**实现**：
```typescript
function setupCanvas(canvas: HTMLCanvasElement, container: HTMLDivElement) {
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  return ctx;
}

// ResizeObserver
resizeObserver.observe(containerRef.current);
// matchMedia 监听
matchMedia('(resolution: 1dppx)').addListener(() => setupCanvas(...));
```

### 3. 坐标系统与变换

**选择**：在 Canvas context 中用 `ctx.save/translate/scale/restore` 临时变换，保持 offsetX/offsetY/actualZoom 为状态变量

**替代方案**：用矩阵变换库（gl-matrix）、完全用 JavaScript 计算坐标、用 CSS 3D transform

**理由**：
- Canvas context 变换 API（save/restore）是标准、开销极小、易于嵌套
- 坐标转换公式简单：`screenX = contentX * actualZoom + offsetX`
- 无需引入额外矩阵库（当前仅需 AABB hitTest，矩阵过重）
- CSS 3D transform 不能绘制到 Canvas，无法应用

**实现**：
```typescript
ctx.save();
ctx.translate(offsetX, offsetY);
ctx.scale(actualZoom, actualZoom);
// 绘制内容坐标系中的 item
item.draw(ctx, actualZoom, now);
ctx.restore();

// 坐标转换
contentX = (screenX - offsetX) / actualZoom;
contentY = (screenY - offsetY) / actualZoom;
```

### 4. 事件处理与分发

**选择**：Canvas 元素上绑定标准 `pointer*` 事件，在事件处理器中做坐标变换和 hitTest

**替代方案**：继续用 PixiJS 事件系统、用 HTML 事件委托、实现自定义事件系统

**理由**：
- PointerEvents 标准 API，自动处理鼠标、触摸、笔触的统一交互
- Canvas 无本地事件冒泡，hitTest + 手动分发即可，代码清晰
- 现有交互逻辑在 handleWheel/handlePointerDown/handleCanvasClick 中已完整，直接改坐标转换即可
- 相比 PixiJS，移除了事件冒泡、hit graph 等框架开销

### 5. 分组切换动画策略

**选择**：离屏 Canvas 预渲染（offscreenCanvas）+ 位移淡入淡出

**替代方案**：逐帧渲染所有 item 带动画、用 Canvas filter/shadow 做特效、改用 CSS animation

**理由**：
- 离屏预渲染一次性绘制整个分组，后续 400ms 只做淡入淡出和位移，性能最优
- 无需修改每个 CanvasImageItem 的绘制逻辑
- 支持降级：目标分组未加载完时，新分组用逐个 item 渲染（带占位色块）
- Canvas filter/shadow 效果单一，CSS animation 无法作用于 Canvas

**实现**：
```typescript
// 动画开始前
const offscreenA = new OffscreenCanvas(width, height);
const ctxA = offscreenA.getContext('2d')!;
// 绘制旧分组到 offscreenA
for (const item of oldGroupItems) item.draw(ctxA, zoom, now);

const offscreenB = new OffscreenCanvas(width, height);
const ctxB = offscreenB.getContext('2d')!;
// 绘制新分组到 offscreenB
for (const item of newGroupItems) item.draw(ctxB, zoom, now);

// 动画中 (400ms easeOutQuart)
ctx.globalAlpha = 1 - t;
ctx.drawImage(offscreenA, 0, 0);
ctx.globalAlpha = t;
ctx.drawImage(offscreenB, 0, 0);
```

### 6. CanvasImageItem 与 InfiniteCanvas 的接口

**选择**：CanvasImageItem 完全独立，无状态，仅通过公开 draw(ctx, zoom, now) 方法；InfiniteCanvas 掌控生命周期

**替代方案**：CanvasImageItem 继承自某个基类、CanvasImageItem 主动调用 markDirty、Zustand store 驱动 item 状态

**理由**：
- 当前 CanvasImageItem 实现完整且无 PixiJS 依赖，无需改动
- InfiniteCanvas 管理池、生命周期、销毁时机，职责清晰
- draw() 返回布尔值表示是否需要下一帧（动画进行中），InfiniteCanvas 据此判断是否停止 rAF

## Risks / Trade-offs

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| Canvas 文字渲染质量 | 低 | 低 | Canvas 2D 文字渲染已成熟，必要时离屏预渲染文字 sprite |
| 快速拖拽时坐标计算漂移 | 极低 | 中 | 用 PointerEvents 原生坐标，确保精度，节流 updateViewport |
| 分组动画与虚拟化冲突 | 中 | 中 | 动画中启用新分组的 updateViewport，预加载，降级渲染 |
| ImageBitmap 在某些浏览器缺失 | 极低 | 高 | Tauri WebView 基于 Chromium，ImageBitmap 标准支持 |
| RequestAnimationFrame 在后台标签页停止 | 低 | 低 | 预期行为，后台不需渲染，焦点回到时自动重启 |
| Resize + DPR 同时变化导致重初始化多次 | 低 | 低 | 用 debounce 或条件检查，仅在实际变化时重初始化 |

## Migration Plan

**分阶段迁移**：

1. **Canvas 初始化与基础渲染循环** (第 1-2 天)
   - 创建 `<canvas>` 元素，设置 DPR
   - 实现 markDirty + renderFrame 循环
   - 测试空白 Canvas 正常绘制背景

2. **事件系统与坐标转换** (第 3-4 天)
   - 迁移 pointer 事件处理
   - 实现坐标变换公式
   - 验证滚轮缩放、拖拽平移

3. **CanvasImageItem 集成与选中交互** (第 5-6 天)
   - 绘制可见 CanvasImageItem
   - 集成 hitTest 和 setSelected
   - 验证选中/悬停边框

4. **分组切换动画与虚拟化** (第 7-8 天)
   - 实现离屏预渲染
   - 集成分组动画
   - 测试快速切组无崩溃

5. **清理与测试** (第 9-10 天)
   - 删除 PixiJS 依赖
   - 删除 ImageInfoOverlay
   - 全量回归测试

## Open Questions

1. **DetectionOverlay 的实现**：网格检测框是否在 Phase 5 中完成还是留给后续？（当前代码中不存在）
2. **离屏 Canvas 大小**：应该与当前 viewport 大小一致还是固定大小？大小变化时是否需要重建？
3. **键盘快捷键的事件冒泡**：W/S 分组切换、Q 全取消等是否需要 global keydown 监听还是仅 canvas focused？
4. **渲染性能指标**：目标 60fps 下的最大图片数是多少？是否需要性能计时器？
