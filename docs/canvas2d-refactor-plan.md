# Canvas 2D 重构开发计划

> 将渲染层从 PixiJS 迁移到原生 Canvas 2D API，彻底解决纹理生命周期竞态导致的崩溃问题。

---

## 一、重构背景

### 1.1 核心问题

快速切换图片分组时反复出现崩溃：

```
Uncaught TypeError: Cannot read properties of null (reading 'naturalWidth')
  at get resourceWidth (TextureSource.ts:487)
  at Object.upload (glUploadImageResource.ts:26)
  at GlTextureSystem.onSourceUpdate (GlTextureSystem.ts:340)
```

**根因**：代码手动将 `texture.source.resource = null` 释放内存，但 PixiJS Batcher 的异步渲染管线仍持有该 TextureSource 引用，在下一帧上传纹理到 GPU 时访问了已置空的 resource。

### 1.2 为什么替换 PixiJS 而非修复

| 维度 | 评估 |
|------|------|
| PixiJS 能力使用率 | ~5-10%（仅 Sprite、Graphics、Text、Container） |
| 未使用的高级特性 | Filter、BlendMode、Mesh、Shader、Mask、Particle、Spine、Assets 系统 |
| 纹理管理系统 | **阻碍大于帮助** — 被迫绕过 Assets 系统，Batcher 异步引用机制导致销毁时序不可控 |
| 框架体积 | ~300KB（gzip ~80KB），功能过重 |
| 实际渲染需求 | 10-20 张可见图片的静态绘制 + 缩放平移，Canvas 2D 硬件加速完全胜任 |

### 1.3 设计决策（已确认）

| 决策项 | 结论 |
|--------|------|
| 渲染性能优化 | 先实现基础版本，后续按需优化 |
| CanvasImageItem 封装 | 保留类的封装形式 |
| 分组切换策略 | 离屏预渲染 + 整体位移（高性能方案） |
| DPR 处理 | resize 回调中统一处理，增加多显示器 DPR 变化监听 |
| 悬停检测 | pointermove + AABB hitTest（可见图片 10-20 张，性能无压力） |
| 渲染模式 | 按需渲染 — `markDirty()` 触发，静止时不消耗资源 |
| 图片缓存格式 | 保持 ImageBitmap，销毁时直接 `close()`，无 PixiJS 对象操作 |

---

## 二、现有代码耦合度分析

### 2.1 文件改动矩阵

| 文件 | PixiJS 耦合度 | 改动类型 | 可复用逻辑 |
|------|-------------|---------|-----------|
| `InfiniteCanvas.tsx` (907行) | 9/10 | **重写** | 事件处理逻辑、动画 easing、store 交互、视口更新 |
| `CanvasImageItem.ts` (493行) | 10/10 | **重写** | 选中/悬停状态机、EXIF 旋转数学、动画时间计算、样式常量 |
| `ImageInfoOverlay.ts` (315行) | 10/10 | **重写** | Badge 构建逻辑、文件名截断、宽度估算、样式常量 |
| `DotBackground.ts` (117行) | 10/10 | **重写** | 波点间距/半径/颜色常量 |
| `GroupTitle.ts` (49行) | 10/10 | **重写** | 标题截断逻辑、样式常量 |
| `DetectionOverlay.tsx` (178行) | 8/10 | **重写** | 坐标计算逻辑、颜色/尺寸常量 |
| `useImageLoader.ts` (308行) | 4/10 | **改造** | LRU 缓存策略（完全复用）、fetch+createImageBitmap（复用）、内存估算 |
| `useImageLoader.test.ts` | 2/10 | **小改** | 测试逻辑基本复用，改 mock 对象 |
| `viewport.ts` (188行) | 0/10 | **不改** | 全部复用 |
| `layout.ts` (314行) | 0/10 | **不改** | 全部复用 |
| `useCanvasStore.ts` (113行) | 0/10 | **不改** | 全部复用 |
| `useAppStore.ts` (78行) | 0/10 | **不改** | 全部复用 |
| `useSelectionStore.ts` (57行) | 0/10 | **不改** | 全部复用 |
| `useThemeStore.ts` (30行) | 0/10 | **不改** | 全部复用 |

### 2.2 依赖图

```
InfiniteCanvas.tsx ─────────────────────────────────────┐
  ├── CanvasImageItem.ts ──── ImageInfoOverlay.ts       │
  ├── DotBackground.ts                                  │
  ├── GroupTitle.ts                                     │
  ├── DetectionOverlay.tsx                              │
  ├── useImageLoader.ts ──── imageService.ts            │  ← 需要改动的层
  ├── viewport.ts ──── layout.ts                        │
  ├── useCanvasStore.ts                                 │  ← 不需要改动的层
  ├── useSelectionStore.ts                              │
  └── useThemeStore.ts                                  │
```

---

## 三、目标架构

### 3.1 新架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│  InfiniteCanvas.tsx (React 组件)                                │
│  - 管理 <canvas> DOM 元素 + DPR 处理                            │
│  - 事件监听 (pointer, wheel, resize)                            │
│  - 按需渲染循环 (dirty flag + rAF)                              │
│  - 管理 CanvasImageItem 实例池                                  │
│  - 分组切换动画编排                                              │
│  - 坐标变换与命中检测                                            │
└───────────────────────┬─────────────────────────────────────────┘
                        │ 调用
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  CanvasImageItem.ts (类)                                        │
│  - 封装单张图片的所有绘制逻辑                                    │
│  - draw(ctx, zoom) 主绘制方法                                   │
│  - 占位色块 / 图片 / EXIF旋转 / 选中边框 / 悬停边框             │
│  - 信息覆盖层 / CheckMark / 检测框                               │
│  - 选中/悬停动画状态机                                           │
└───────────────────────┬─────────────────────────────────────────┘
                        │ 使用
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  ImageCache (改造自 useImageLoader.ts)                           │
│  - LRU 缓存 ImageBitmap（复用现有 LRU 逻辑）                    │
│  - fetch + createImageBitmap 加载                                │
│  - 销毁: 直接 bitmap.close()，无 PixiJS 对象                    │
│  - 无竞态风险：ImageBitmap 销毁后 drawImage 只是 no-op           │
└─────────────────────────────────────────────────────────────────┘

不变的层：
  viewport.ts / layout.ts / useCanvasStore.ts / useSelectionStore.ts / useThemeStore.ts
```

### 3.2 关键架构变化

| 概念 | PixiJS (旧) | Canvas 2D (新) |
|------|------------|----------------|
| 场景图 | `Container` / `Sprite` 实例树，框架自动遍历渲染 | 无场景图，每帧按顺序调用绘制函数 |
| 状态 | 对象属性突变 `sprite.alpha = 0.5` | 每帧从状态计算绘制参数 |
| 变换 | `container.scale.set(2)` 持久化 | `ctx.save/translate/scale/restore` 临时变换 |
| 纹理 | `Texture` + `TextureSource` + GPU 上传 | `ImageBitmap` + `ctx.drawImage()` |
| 命中检测 | 框架内建 `eventMode` + 事件冒泡 | 手动 AABB 坐标计算 |
| 渲染驱动 | PixiJS Ticker 自动 60fps | `requestAnimationFrame` + dirty flag 按需渲染 |
| 文字 | `Text` + `TextStyle` 对象（创建开销大） | `ctx.font` + `ctx.fillText()` 即时绘制 |
| 渐变 | `FillGradient` 对象 | `ctx.createLinearGradient()` |
| 平铺图案 | `TilingSprite` | `ctx.createPattern()` + `ctx.fillRect()` |

### 3.3 竞态问题如何被根治

**旧流程（PixiJS）：**
```
evictTexture() → source.resource = null → Batcher 下一帧访问 null → 崩溃
```

**新流程（Canvas 2D）：**
```
evictTexture() → bitmap.close() → drawImage(closedBitmap) → 静默无操作，不崩溃
```

Canvas 2D 的 `drawImage()` 对已 close 的 ImageBitmap 不会抛异常，只是不绘制。加上按需渲染机制，已销毁的 item 根本不会被绘制。

---

## 四、详细实施计划

### Phase 1: ImageCache 改造

**改动文件**: `src/hooks/useImageLoader.ts`, `src/hooks/useImageLoader.test.ts`

**目标**: 将缓存对象从 `Texture` 改为 `ImageBitmap`，移除所有 PixiJS 依赖。

#### 1.1 类型变更

```typescript
// 旧
import { Texture, ImageSource } from 'pixi.js';
export type CacheEntry = { texture: Texture; memorySize: number; version: number; };

// 新
export type CacheEntry = { image: ImageBitmap; memorySize: number; version: number; };
```

#### 1.2 TextureLRUCache → ImageLRUCache

- 类名改为 `ImageLRUCache`
- `get(key)` 返回 `ImageBitmap | undefined`
- `set(key, image)` 接收 `ImageBitmap`
- `isTextureValid()` → `isImageValid()`
- LRU 淘汰逻辑、容量控制、内存估算 **完全复用**

#### 1.3 销毁逻辑简化

```typescript
// 旧: 170+ 行的 destroyTexture，操作 source/resource/unload
function destroyTexture(texture: Texture): void {
  const source = texture.source;
  const resource = source.resource;
  (resource as ImageBitmap).close();
  source.resource = null;   // ← 崩溃根因
  source.unload();
}

// 新: 1 行
function destroyImage(image: ImageBitmap): void {
  image.close();
}
```

#### 1.4 加载逻辑简化

```typescript
// 旧: fetch → createImageBitmap → new ImageSource → new Texture
// 新: fetch → createImageBitmap（直接返回，无 PixiJS 包装）
async function loadImageFromUrl(url: string): Promise<ImageBitmap> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return createImageBitmap(blob);
}
```

#### 1.5 ImageLoader 类接口变更

```typescript
class ImageLoader {
  private imageCache: ImageLRUCache;
  private pending: Map<string, Promise<ImageWithVersion | null>>;

  loadImage(hash: string, displayWidth: number): Promise<ImageWithVersion | null>;
  reloadForZoomChange(entries: ..., onImageReady: ...): Promise<void>;
  getCache(): ImageLRUCache;
  evictImage(hash: string): void;
  destroy(): void;
}

type ImageWithVersion = { image: ImageBitmap; key: string; version: number; };
```

#### 1.6 测试改造

- mock `pixi.js` → 移除
- `Texture` 相关断言 → 改为 `ImageBitmap` 断言
- LRU 逻辑测试用例 **全部保留**

---

### Phase 2: CanvasImageItem 重写

**改动文件**: `src/components/canvas/CanvasImageItem.ts`（重写）

**目标**: 保留类封装形式，内部改为 Canvas 2D 绘制。

#### 2.1 类接口设计

```typescript
class CanvasImageItem {
  // ── 只读属性 ──
  readonly hash: string;
  readonly groupIndex: number;

  // ── 位置与尺寸（由 LayoutItem 初始化）──
  x: number;
  y: number;
  width: number;
  height: number;

  // ── 视觉状态 ──
  alpha: number;            // 分组切换淡入淡出
  image: ImageBitmap | null; // null 时绘制占位色块
  orientation: number;       // EXIF Orientation (1-8)

  // ── 公共方法 ──
  constructor(layoutItem: LayoutItem);
  setImage(image: ImageBitmap, orientation?: number): void;
  setImageInfo(fileName: string, metadata?: ImageMetadata): void;
  setSelected(selected: boolean): void;
  setHovered(hovered: boolean): void;
  updateZoomVisibility(zoomLevel: number): void;
  draw(ctx: CanvasRenderingContext2D, zoom: number, now: number): void;
  hitTest(contentX: number, contentY: number): boolean;
  destroy(): void;
}
```

#### 2.2 draw() 方法绘制顺序

```
draw(ctx, zoom, now) {
  if (alpha <= 0) return;  // 隐藏的分组不绘制

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);

  // 1. 占位色块 或 图片
  if (image) {
    drawImageWithOrientation(ctx, image, orientation, width, height);
  } else {
    ctx.fillStyle = '#E0E4EB';
    ctx.fillRect(0, 0, width, height);
  }

  // 2. 选中叠加层 + 边框 + CheckMark（带动画）
  if (isSelected || selectionAnimProgress > 0) {
    drawSelectionOverlay(ctx, now);
  }

  // 3. 悬停边框
  if (isHovered && !isSelected) {
    drawHoverBorder(ctx);
  }

  // 4. 信息覆盖层（缩放阈值控制可见性）
  if (infoOverlayAlpha > 0) {
    drawInfoOverlay(ctx, zoom);
  }

  ctx.restore();
}
```

#### 2.3 精确样式参数（从现有代码提取）

**占位色块:**
```
颜色: #E0E4EB (0xE0E4EB)
尺寸: 与 layoutItem.width/height 一致
```

**选中叠加层:**
```
半透明叠加: color=#2563A8, alpha=0.08
内侧描边: color=#2563A8, width=1px, alpha=0.15
```

**选中边框:**
```
外发光: rect 向外扩展 6px, color=#2563A8, width=3px, alpha=0.2
实色边框: rect 向外扩展 1.5px, color=#2563A8, width=3px, alpha=1.0
```

**CheckMark (✓):**
```
位置: 右上角, cx = width - 10 - 13, cy = 10 + 13
白色外环: circle(cx, cy, r=15), color=#FFFFFF, alpha=0.9
品牌色圆形: circle(cx, cy, r=13), color=#2563A8
白色对勾: moveTo(cx-5, cy) → lineTo(cx-1.5, cy+4) → lineTo(cx+6, cy-5), stroke=#FFFFFF, width=2.5px
弹性缩放动画: s = 1 - pow(1-t, 3) * cos(t * PI * 0.5)
```

**悬停边框:**
```
外发光: rect 向外扩展 4px, color=#2563A8, width=3px, alpha=0.2
品牌色边框: rect 向外扩展 1px, color=#2563A8, width=2px
```

**选中动画:**
```
渐入: 200ms, alpha 0→1, checkmark scale 弹性 0→1
渐出: 120ms (200ms * 0.6), alpha 1→0
尊重 prefers-reduced-motion: 时长设为 0
```

#### 2.4 信息覆盖层绘制（内联到 CanvasImageItem）

不再单独创建 `ImageInfoOverlay` 类，直接在 `CanvasImageItem.draw()` 中绘制。

**渐变背景:**
```
位置: 底部 40% 区域
渐变: ctx.createLinearGradient, 从 rgba(0,0,0,0) 到 rgba(0,0,0,0.6)
```

**文件名:**
```
字体: 600 11px system-ui, -apple-system, sans-serif
颜色: #FFFFFF
位置: 左下角, paddingLeft=8px, paddingBottom=8px
截断: 根据宽度估算最大字符数, 超出加 "..."
```

**参数 Badge:**
```
背景: roundRect, color=#000000, alpha=0.5, borderRadius=8px
padding: 水平 6px, 垂直 3px
字体: 10px system-ui, -apple-system, sans-serif, color=#FFFFFF
间距: badge 之间 4px, 行间距 3px
```

**合焦评分 Badge:**
```
星级文本: ★ (\u2605) 和 ☆ (\u2606)
背景色按评分:
  5分=#4CAF50 (绿), 4分=#2196F3 (蓝), 3分=#FF9800 (橙), 2分=#F44336 (红), 1分=#F44336 (红)
alpha=0.75, borderRadius=8px
```

**缩放补偿:**
```
当 zoom >= 0.4: 完全可见
当 0.3 <= zoom < 0.4: alpha 线性淡入
当 zoom < 0.3: 完全隐藏
文字大小反向补偿: 绘制时 ctx.scale(1/zoom, 1/zoom)，使文字保持恒定视觉大小
```

#### 2.5 EXIF Orientation 变换

Canvas 2D 实现，复用现有数学逻辑：

```typescript
function drawImageWithOrientation(
  ctx: CanvasRenderingContext2D,
  image: ImageBitmap,
  orientation: number,
  w: number, h: number
): void {
  ctx.save();
  // orientation 5,6,7,8 需要交换宽高
  const swapped = orientation >= 5;
  const dw = swapped ? h : w;
  const dh = swapped ? w : h;

  switch (orientation) {
    case 2: ctx.translate(w, 0); ctx.scale(-1, 1); break;
    case 3: ctx.translate(w, h); ctx.rotate(Math.PI); break;
    case 4: ctx.translate(0, h); ctx.scale(1, -1); break;
    case 5: ctx.translate(0, 0); ctx.rotate(Math.PI/2); ctx.scale(1, -1); break;
    case 6: ctx.translate(w, 0); ctx.rotate(Math.PI/2); break;
    case 7: ctx.translate(w, h); ctx.rotate(Math.PI/2); ctx.scale(-1, 1); break; // 待确认
    case 8: ctx.translate(0, h); ctx.rotate(-Math.PI/2); break;
    default: break; // orientation 1: 无变换
  }

  ctx.drawImage(image, 0, 0, dw, dh);
  ctx.restore();
}
```

#### 2.6 hitTest 实现

```typescript
hitTest(contentX: number, contentY: number): boolean {
  return contentX >= this.x && contentX <= this.x + this.width
      && contentY >= this.y && contentY <= this.y + this.height;
}
```

---

### Phase 3: 波点背景 + 分组标题

**改动文件**: `src/components/canvas/DotBackground.ts`（重写）, `src/components/canvas/GroupTitle.ts`（重写）

#### 3.1 波点背景

改为生成一个离屏 canvas pattern，每帧只做一次 `fillRect`。

**精确参数:**
```
波点间距: 40px
波点半径: 1.0px
亮色主题: #E0E4EB, alpha=0.5
暗色主题: #232D40, alpha=0.5
```

**实现:**
```typescript
class DotBackground {
  private pattern: CanvasPattern | null = null;
  private currentTheme: Theme = 'light';

  // 初始化/主题切换时重建 pattern
  updateTheme(theme: Theme): void {
    const size = 40; // DOT_SPACING
    const offscreen = new OffscreenCanvas(size, size);
    const octx = offscreen.getContext('2d')!;
    octx.clearRect(0, 0, size, size);
    octx.fillStyle = theme === 'light' ? '#E0E4EB' : '#232D40';
    octx.globalAlpha = 0.5;
    octx.beginPath();
    octx.arc(size / 2, size / 2, 1.0, 0, Math.PI * 2);
    octx.fill();
    this.pattern = mainCtx.createPattern(offscreen, 'repeat');
    this.currentTheme = theme;
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (!this.pattern) return;
    ctx.fillStyle = this.pattern;
    ctx.fillRect(0, 0, width, height);
  }
}
```

#### 3.2 分组标题

**精确参数:**
```
字体: 700 16px system-ui, -apple-system, sans-serif
颜色: #374151
paddingTop: 16px
截断: 超出组宽度时加 "..."
```

**实现:** 在 InfiniteCanvas 的渲染循环中直接调用 `ctx.fillText()`，不需要独立类。

---

### Phase 4: DetectionOverlay 改造

**改动文件**: `src/components/DetectionOverlay.tsx`（重写）

改为纯绘制函数，由 CanvasImageItem 在 draw() 中调用。

**精确参数:**
```
主框颜色: #22C55E (绿色, 置信度最高)
副框颜色: #EAB308 (黄色)
线宽: 2px
折角尺寸: 12px
标签背景: #000000, alpha=0.7
最小框尺寸: 10px (小于此不绘制)
坐标系: 归一化 [0,1] × displayWidth/Height 转像素
```

---

### Phase 5: InfiniteCanvas 重写

**改动文件**: `src/components/canvas/InfiniteCanvas.tsx`（重写）

这是工作量最大的阶段。以下按子系统分解。

#### 5.1 Canvas 初始化与 DPR 处理

```typescript
// 替代 PixiJS Application 初始化
const canvasRef = useRef<HTMLCanvasElement>(null);
const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

function setupCanvas(canvas: HTMLCanvasElement, container: HTMLDivElement): void {
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctxRef.current = ctx;
}

// ResizeObserver 中也调用 setupCanvas 重新适配
// 新增: matchMedia('(resolution: ...)').addEventListener 监听 DPR 变化
```

#### 5.2 按需渲染循环

```typescript
const dirtyRef = useRef(true);
const rafIdRef = useRef(0);

function markDirty(): void {
  if (dirtyRef.current) return; // 避免重复调度
  dirtyRef.current = true;
  rafIdRef.current = requestAnimationFrame(renderFrame);
}

function renderFrame(): void {
  if (!dirtyRef.current) return;
  dirtyRef.current = false;

  const ctx = ctxRef.current;
  const canvas = canvasRef.current;
  if (!ctx || !canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const screenW = canvas.width / dpr;
  const screenH = canvas.height / dpr;

  // 1. 清空
  ctx.clearRect(0, 0, screenW, screenH);

  // 2. 背景色
  ctx.fillStyle = theme === 'light' ? '#FFFFFF' : '#0A0E1A';
  ctx.fillRect(0, 0, screenW, screenH);

  // 3. 波点背景（固定视口，不跟随平移缩放）
  dotBackground.draw(ctx, screenW, screenH);

  // 4. 内容层（应用变换）
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(actualZoom, actualZoom);

  // 5. 绘制所有可见 CanvasImageItem
  const now = performance.now();
  for (const item of canvasItemsRef.current.values()) {
    item.draw(ctx, actualZoom, now);
  }

  // 6. 分组标题
  drawGroupTitles(ctx);

  ctx.restore();
}
```

**触发 markDirty() 的时机:**
- 鼠标滚轮缩放
- 拖拽平移
- 分组切换动画每帧
- 选中/悬停状态变化
- 纹理加载完成
- 窗口 resize
- 主题切换
- 选中动画进行中

#### 5.3 事件处理（复用现有逻辑）

所有事件处理器的逻辑与现有代码一致，只需将坐标变换公式中的 `contentLayer.x/y` 替换为 `offsetX/offsetY` 变量。

**鼠标滚轮 (handleWheel):**
```
Ctrl/Meta + 滚轮: 锚点缩放
  - Y 轴以鼠标位置为锚点
  - X 轴始终居中
  - clamp MIN_ZOOM(0.1) ~ MAX_ZOOM(3.0)
  - 灵敏度: ZOOM_SENSITIVITY = 0.001
普通滚轮: 组内纵向滚动
  - clamp scrollY 到 [0, maxScrollY]
  - 节流 updateViewport (16ms)
两种情况都调用 markDirty()
```

**拖拽 (pointerdown → pointermove → pointerup):**
```
死区: DRAG_DEAD_ZONE = 5px
超过死区: 更新 offsetX/offsetY + markDirty() + updateViewport()
未超过死区: 视为点击 → handleCanvasClick()
```

**点击 (handleCanvasClick):**
```
屏幕坐标 → 内容坐标: contentX = (screenX - offsetX) / actualZoom
遍历 canvasItems:
  - 跳过 alpha <= 0 的 item
  - 跳过非当前分组的 item
  - item.hitTest(contentX, contentY)
  - 命中: toggleSelection(hash) + syncSelectionVisuals() + markDirty()
```

**悬停 (pointermove，非拖拽状态):**
```
与点击相同的坐标转换和 hitTest
找到 hoveredItem → item.setHovered(true) + markDirty()
之前 hovered 的 item → item.setHovered(false) + markDirty()
```

#### 5.4 视口更新与虚拟化（复用现有逻辑）

```typescript
function updateViewport(): void {
  // 坐标转换: offsetX/offsetY → ViewportRect
  const viewportRect: ViewportRect = {
    x: -offsetX / actualZoom,
    y: -offsetY / actualZoom,
    width: screenWidth / actualZoom,
    height: screenHeight / actualZoom,
  };

  // 复用 viewport.ts 的函数
  const currVisible = getVisibleItems(layout.pages, layout.pageWidth, viewportRect);
  const diff = diffVisibleItems(prevVisible, currVisible);

  // leave: 销毁 CanvasImageItem + evict 缓存
  for (const item of diff.leave) {
    const ci = canvasItemsRef.current.get(item.hash);
    if (ci) {
      ci.destroy();
      canvasItemsRef.current.delete(item.hash);
    }
    imageLoader.evictImage(item.hash);
  }

  // enter: 创建 CanvasImageItem + 异步加载图片
  for (const item of diff.enter) {
    const ci = new CanvasImageItem(item);
    ci.setImageInfo(fileNames.get(item.hash), metadata.get(item.hash));
    ci.updateZoomVisibility(zoomLevel);
    canvasItemsRef.current.set(item.hash, ci);

    imageLoader.loadImage(item.hash, displayWidth).then((result) => {
      if (!result) return;
      if (!imageLoader.getCache().isImageValid(result.key, result.version)) return;
      const ci = canvasItemsRef.current.get(item.hash);
      if (ci) {
        ci.setImage(result.image);
        markDirty(); // 图片加载完成，触发重绘
      }
    });
  }

  prevVisible = currVisible;
  setViewport(-viewportRect.x, -viewportRect.y);
  setViewportRect(viewportRect);
}
```

#### 5.5 分组切换动画（高性能方案）

**离屏预渲染 + 整体位移策略：**

```
动画开始前:
  1. 将当前组所有 item 绘制到 offscreenCanvasA
  2. 将目标组所有 item 绘制到 offscreenCanvasB（需先加载）

动画过程中 (400ms, easeOutQuart):
  每帧只执行:
    - ctx.globalAlpha = 1 - t → drawImage(offscreenCanvasA) // 旧组淡出
    - ctx.globalAlpha = t     → drawImage(offscreenCanvasB) // 新组淡入
    - 两个 canvas 水平位移动画

动画结束后:
  - 释放 offscreenCanvas
  - 切回正常逐个绘制模式
  - ensureOnlyGroupVisible(targetIndex)
```

**降级策略（目标组尚未加载完成时）：**
```
如果目标组图片尚未全部加载完:
  - 旧组仍用 offscreen 缓存
  - 新组直接用 CanvasImageItem 逐个绘制（含占位色块）
  - 图片陆续加载完成后 markDirty() 刷新
```

**easing 函数（保持现有）：**
```
easeOutQuart: 1 - pow(1 - t, 4)
时长: GROUP_TRANSITION_MS = 400ms
尊重 prefers-reduced-motion: 时长设为 0（直接跳转）
```

**动画期间的状态:**
```
transitionAnimRef: 存储 rAF ID（用于取消）
isTransitioning: true（store 状态）
prevGroupIndexRef: 动画前的分组索引

动画每帧:
  1. 计算 eased progress t
  2. 插值 offsetX, offsetY（起点 → 终点）
  3. 插值 scale（如有缩放补偿差异）
  4. 绘制 offscreen canvases (或 fallback 逐个绘制 + alpha)
  5. updateViewport()（为下一组预加载图片）

动画结束:
  setTransitioning(false)
  ensureOnlyGroupVisible(targetIndex)
  更新 prevGroupIndexRef
```

#### 5.6 坐标系统

```
屏幕坐标系 (screen):
  原点: canvas 左上角
  单位: CSS 像素

内容坐标系 (content):
  原点: 内容区域左上角
  单位: 布局像素（不受缩放影响）

转换:
  screenX = contentX * actualZoom + offsetX
  screenY = contentY * actualZoom + offsetY
  contentX = (screenX - offsetX) / actualZoom
  contentY = (screenY - offsetY) / actualZoom

actualZoom = zoomLevel * zoomCompensation
zoomCompensation = baseColumnWidth / page.columnWidth
```

#### 5.7 useImperativeHandle 接口（保持不变）

```typescript
interface InfiniteCanvasHandle {
  syncSelectionVisuals(): void;  // 同步选中状态到可见 item
  scrollToY(y: number): void;    // 滚动到指定 Y 坐标
  updateItemMetadata(hash: string): void;  // 更新单张图片元数据
}
```

#### 5.8 组件 JSX 结构变更

```tsx
// 旧: 只有一个 <div>，PixiJS 自动创建 <canvas> 并 appendChild
<div ref={containerRef} ... />

// 新: 显式包含 <canvas>
<div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
  <canvas
    ref={canvasRef}
    style={{ display: 'block', width: '100%', height: '100%' }}
  />
  <div role="status" aria-live="polite" aria-atomic="true" ...>
    {selectedCount > 0 ? `已选中 ${selectedCount} 张图片` : '未选中图片'}
  </div>
</div>
```

#### 5.9 Cleanup

```typescript
return () => {
  destroyed = true;
  cancelAnimationFrame(rafIdRef.current);
  cancelAnimationFrame(transitionAnimRef.current);
  // 移除事件监听
  canvas.removeEventListener('wheel', handleWheel);
  canvas.removeEventListener('pointerdown', handlePointerDown);
  window.removeEventListener('pointermove', handlePointerMove);
  window.removeEventListener('pointerup', handlePointerUp);
  resizeObserver.disconnect();
  // 销毁所有 CanvasImageItem
  for (const item of canvasItemsRef.current.values()) {
    item.destroy();
  }
  canvasItemsRef.current.clear();
  // 销毁 ImageLoader
  imageLoaderRef.current?.destroy();
};
```

---

### Phase 6: 清理与集成测试

#### 6.1 删除 PixiJS 相关代码

- 删除 `src/components/canvas/ImageInfoOverlay.ts`（逻辑内联到 CanvasImageItem）
- 删除 `src/components/canvas/GroupTitle.ts`（逻辑内联到 InfiniteCanvas）
- 移除 `package.json` 中的 `pixi.js` 依赖
- 运行 `npm uninstall pixi.js`
- 全局搜索确认无残留 pixi import

#### 6.2 保留但已改造的文件

- `InfiniteCanvas.tsx` — 重写
- `CanvasImageItem.ts` — 重写
- `DotBackground.ts` — 重写
- `DetectionOverlay.tsx` — 重写
- `useImageLoader.ts` — 改造

#### 6.3 完全不变的文件

- `viewport.ts`
- `layout.ts`
- `useCanvasStore.ts`
- `useAppStore.ts`
- `useSelectionStore.ts`
- `useThemeStore.ts`

#### 6.4 集成测试清单

| 测试项 | 验证内容 |
|--------|---------|
| 基本渲染 | 打开文件夹后图片正常显示，占位色块 → 图片过渡 |
| 缩放 | Ctrl+滚轮缩放 0.1x~3.0x，锚点正确 |
| 平移 | 拖拽平移流畅，不越界 |
| 组内滚动 | 滚轮纵向滚动，clamp 到内容范围 |
| 分组切换 | 点击分组 / W/S 键切换，动画流畅无闪烁 |
| **快速切组** | **连续快速切组不崩溃**（核心验证项） |
| 选中 | 点击选中/取消，边框+✓标记显示正确 |
| 悬停 | 鼠标悬停高亮，移出恢复 |
| 信息覆盖层 | 缩放到 0.4 以上时显示文件名+Badge |
| 主题切换 | 亮色/暗色主题正确切换背景和波点颜色 |
| 适应窗口 | fitToWindow 功能正常 |
| 窗口缩放 | resize 后画布自适应，DPR 正确 |
| 纹理质量切换 | 缩放过阈值时 thumbnail ↔ medium 切换 |
| 内存 | 长时间浏览不内存泄漏，LRU 淘汰正常 |
| 检测框 | 鸟类检测 bbox 绘制位置和颜色正确 |

---

## 五、实施顺序与依赖关系

```
Phase 1: ImageCache 改造
    │  无外部依赖，可独立完成
    ▼
Phase 2: CanvasImageItem 重写
    │  依赖 Phase 1 的 ImageBitmap 类型
    ▼
Phase 3: 波点背景 + 分组标题
    │  无依赖，可与 Phase 2 并行
    ▼
Phase 4: DetectionOverlay 改造
    │  依赖 Phase 2 的 CanvasImageItem 接口
    │  可与 Phase 3 并行
    ▼
Phase 5: InfiniteCanvas 重写
    │  依赖 Phase 1-4 全部完成
    ▼
Phase 6: 清理与集成测试
    │  依赖 Phase 5 完成
    ▼
  完成
```

**可并行的组合：**
- Phase 2 + Phase 3（CanvasImageItem 和 DotBackground 互不依赖）
- Phase 3 + Phase 4（DotBackground 和 DetectionOverlay 互不依赖）

---

## 六、常量参考速查表

### 缩放与交互

| 常量 | 值 | 说明 |
|------|-----|------|
| `MIN_ZOOM` | 0.1 | 最小缩放 |
| `MAX_ZOOM` | 3.0 | 最大缩放 |
| `ZOOM_SENSITIVITY` | 0.001 | 滚轮缩放灵敏度 |
| `DRAG_DEAD_ZONE` | 5 | 拖拽死区像素 |
| `GROUP_TRANSITION_MS` | 400 | 分组切换动画时长 ms |
| `BG_COLOR_LIGHT` | `#FFFFFF` | 亮色背景 |
| `BG_COLOR_DARK` | `#0A0E1A` | 暗色背景 |

### 选中/悬停样式

| 常量 | 值 | 说明 |
|------|-----|------|
| `SELECTION_COLOR` | `#2563A8` | 品牌靛蓝 |
| `SELECTION_BORDER_WIDTH` | 3 | 选中边框宽度 |
| `HOVER_BORDER_WIDTH` | 2 | 悬停边框宽度 |
| `CHECK_RADIUS` | 13 | ✓ 标记圆形半径 |
| `CHECK_OFFSET` | 10 | ✓ 标记右上角偏移 |
| `SELECTION_OVERLAY_ALPHA` | 0.08 | 选中叠加层透明度 |
| `SELECTION_GLOW_ALPHA` | 0.2 | 外发光透明度 |
| `SEL_ANIM_DURATION` | 200 | 选中动画时长 ms |
| `PLACEHOLDER_COLOR` | `#E0E4EB` | 占位色块颜色 |

### 信息覆盖层

| 常量 | 值 | 说明 |
|------|-----|------|
| `INFO_OVERLAY_MIN_ZOOM` | 0.3 | 信息层可见最低缩放 |
| `INFO_OVERLAY_FADE_RANGE` | 0.1 | 淡入区间 |
| `FILE_NAME_FONT_SIZE` | 11 | 文件名字号 |
| `PARAM_FONT_SIZE` | 10 | 参数字号 |
| `BADGE_PADDING_X` | 6 | Badge 水平内边距 |
| `BADGE_PADDING_Y` | 3 | Badge 垂直内边距 |
| `BADGE_RADIUS` | 8 | Badge 圆角半径 |
| `BADGE_GAP` | 4 | Badge 间距 |
| `ROW_GAP` | 3 | 行间距 |
| `LEFT_PADDING` | 8 | 左侧内边距 |
| `VERTICAL_PADDING` | 8 | 垂直内边距 |

### 波点背景

| 常量 | 值 | 说明 |
|------|-----|------|
| `DOT_SPACING` | 40 | 波点间距 px |
| `DOT_RADIUS` | 1.0 | 波点半径 px |
| `DOT_COLOR_LIGHT` | `#E0E4EB` | 亮色波点 |
| `DOT_COLOR_DARK` | `#232D40` | 暗色波点 |
| `DOT_ALPHA` | 0.5 | 波点透明度 |

### 分组标题

| 常量 | 值 | 说明 |
|------|-----|------|
| `TITLE_PADDING` | 16 | 标题上边距 |
| `TITLE_FONT_SIZE` | 16 | 标题字号 |
| `TITLE_FONT_WEIGHT` | 700 | 标题字重 |
| `TITLE_COLOR` | `#374151` | 标题颜色 |

### 检测框

| 常量 | 值 | 说明 |
|------|-----|------|
| `PRIMARY_BOX_COLOR` | `#22C55E` | 主框颜色(绿) |
| `SECONDARY_BOX_COLOR` | `#EAB308` | 副框颜色(黄) |
| `BOX_LINE_WIDTH` | 2 | 检测框线宽 |
| `CORNER_SIZE` | 12 | 折角尺寸 |
| `MIN_BOX_SIZE` | 10 | 最小框尺寸阈值 |

### 图片缓存

| 常量 | 值 | 说明 |
|------|-----|------|
| `DEFAULT_MEMORY_LIMIT` | 200MB | 缓存内存上限 |
| `THUMBNAIL_PIXEL_WIDTH` | 200 | 缩略图宽度阈值 |
| `CACHE_CAPACITY` | 20 | LRU 缓存条目数 |

---

## 七、风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| Canvas 2D 文字渲染质量差 | 低 | 中 | Canvas 2D 文字渲染已相当成熟；必要时用离屏 canvas 预渲染文字 |
| 大量图片时 drawImage 性能不足 | 低 | 高 | 当前只绘制可见的 10-20 张；必要时加脏矩形或分层 canvas |
| EXIF 旋转适配遗漏 | 中 | 低 | 用 orientation 1-8 样本图逐个验证 |
| 选中动画帧率不足 | 低 | 低 | 动画期间持续 rAF 直到动画完成 |
| ImageBitmap 在某些浏览器行为差异 | 极低 | 中 | Tauri WebView 基于 Chromium，行为一致 |
