## Context

Bulbul 是一个 Tauri 2 桌面应用（React 18 + Rust），管理和展示重复/相似 RAW 格式图片的分组。画布使用原生 Canvas 2D 渲染缩略图。

当前悬停交互使用 Magnifier 组件——一个 HTML overlay 弹出窗口，显示整张 medium 质量图片和元数据信息面板。用户反馈该交互不符合"放大镜"直觉，期望类似相机监视器局部放大的效果：鼠标控制一个放大视窗，显示鼠标位置对应的全图放大区域，可拖动查看不同位置。

技术约束：
- 画布坐标系：内容空间 + `ctx.translate/scale` 变换，仅纵向滚动
- 图片质量：thumbnail（600px）和 medium（1920px），无原始 NEF 尺寸
- EXIF orientation：后端为 5-8 自动交换宽高，前端需视觉旋转
- ImageBitmap 生命周期：需要显式 `close()` 释放 GPU 内存

## Goals / Non-Goals

**Goals:**
- 实现方形圆角放大镜视窗，跟随鼠标显示对应位置的全图放大区域
- 鼠标在缩略图上的位置精确映射到全图对应区域
- 支持滚轮调节放大倍率（1.5x-10x）
- 正确处理 EXIF orientation（纵向图片放大区域正确）
- 流畅的淡入淡出过渡

**Non-Goals:**
- 不在 Canvas 上直接绘制放大镜（避免干扰主渲染循环）
- 不加载原始 NEF 尺寸图片（仅使用已有的 medium 质量）
- 不支持圆形视窗
- 不在放大镜中显示元数据信息

## Decisions

### 1. HTML overlay + 内部 `<canvas>` 渲染

**选择**: 使用 React 组件 + 内部 `<canvas>` 元素渲染放大区域

**理由**:
- 方形圆角、阴影、淡入淡出用 CSS 实现更自然
- 不干扰主画布的 dirty flag / rAF 渲染循环
- 当前 Magnifier 已是 HTML overlay，架构一致
- 内部 `<canvas>` 可精确控制 `drawImage` 的源/目标区域

**备选**: 在主 Canvas 上直接绘制放大镜——会增加渲染循环复杂度，圆角阴影需手动实现

### 2. 离屏 canvas 预旋转 EXIF orientation

**选择**: 加载 medium ImageBitmap 后创建离屏 canvas，一次性应用 orientation 变换绘制完整图像，后续帧直接裁切

**理由**:
- 避免每次鼠标移动时重复处理 orientation 变换
- 代码逻辑与 CanvasImageItem._drawImageWithOrientation() 一致
- 离屏 canvas 缓存在 Loupe 组件 ref 中，hash 不变时复用

### 3. 独立加载 medium ImageBitmap

**选择**: Loupe 组件通过 imageService 独立加载 medium 图片，不依赖主画布 ImageLoader 的 LRU 缓存

**理由**:
- 避免与主画布缓存竞争淘汰
- 主画布 LRU 的 pin/unpin 生命周期由视口虚拟化管理，Loupe 不应干预
- medium 图通常已被主画布缓存，后端读取速度快

### 4. 滚轮倍率调节优先级

**选择**: 放大镜可见时，普通滚轮调节放大镜倍率而非滚动画布；Ctrl+滚轮始终控制画布缩放

**理由**:
- 放大镜激活时用户意图是调倍率，不是滚动画布
- Ctrl+滚轮保持画布缩放不变，提供逃生路径
- 倍率调节使用乘法式灵敏度（`newMag = oldMag * (1 - deltaY * 0.005)`），与画布缩放体验一致

### 5. 放大源区域计算

**选择**: 以鼠标在缩略图上的相对位置映射到 medium 图逻辑坐标，以该点为中心计算放大源区域

**坐标映射链**:
1. 屏幕 → 内容: `contentX = screenX / zoom`, `contentY = (screenY - offsetY) / zoom`
2. 内容 → 缩略图相对: `relX = (contentX - item.x) / item.width`
3. 相对 → medium 逻辑: `logicalX = relX * metadata.imageWidth`
4. 源区域: `sourceW = LOUPE_SIZE * imageWidth / (M * item.width * zoom)`, 以 logicalX 为中心

**边界处理**: 源区域 clamp 到图像边界，防止显示黑边

## Risks / Trade-offs

- **[两套 ImageBitmap 加载]** Loupe 和主画布可能同时持有同一张图的不同 ImageBitmap → 使用独立加载，medium 图本地读取速度快，内存开销可控（一张 1920px ImageBitmap 约 15MB）
- **[离屏 canvas 内存]** 每个 hash 切换时创建离屏 canvas → hash 变化时清空旧 canvas，仅持有一个
- **[滚轮语义冲突]** 放大镜可见时滚轮含义改变 → Ctrl+滚轮始终控制画布缩放，提供一致的逃生路径；放大镜消失时恢复滚动
