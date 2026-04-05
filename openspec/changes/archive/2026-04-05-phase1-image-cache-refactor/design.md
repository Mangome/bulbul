## Context

当前 `useImageLoader.ts` 通过 `fetch → createImageBitmap → new ImageSource → new Texture` 加载图片，包裹在 PixiJS 的 `Texture`/`ImageSource` 对象中。销毁时需要操作 `source.resource = null` + `source.unload()`，但 PixiJS Batcher 异步引用机制使得任何销毁时机都不完全安全，导致快速切组时崩溃。

现有代码已经自行绕过 PixiJS Assets 系统（直接 fetch），PixiJS 包装层（ImageSource → Texture）实质上只是一层不必要的封装。

**约束：**
- Phase 1 只改 `useImageLoader.ts` 及其测试，不改消费者（InfiniteCanvas、CanvasImageItem）
- `pixi.js` 依赖暂不移除（其他文件仍依赖）
- 消费者适配在后续 Phase 处理，Phase 1 完成后编译会有类型错误（预期行为）

## Goals / Non-Goals

**Goals:**
- 移除 `useImageLoader.ts` 对 `pixi.js` 的依赖
- 缓存对象从 `Texture` 改为 `ImageBitmap`，消除销毁竞态
- 保持 LRU 淘汰策略、内存估算、去重加载（pending map）等已验证的逻辑不变
- 接口语义保持一致，仅类型从 Texture 改为 ImageBitmap

**Non-Goals:**
- 不改动 InfiniteCanvas.tsx 或 CanvasImageItem.ts（Phase 2/5 范围）
- 不移除 `pixi.js` npm 依赖（Phase 6 范围）
- 不改变缓存容量、内存上限等策略参数
- 不引入新的缓存层级或预加载策略

## Decisions

### 1. 缓存对象选型：ImageBitmap

**选择**: 直接缓存 `ImageBitmap`，不引入中间包装层。

**替代方案考虑**:
- `HTMLImageElement`: 不支持 `close()` 主动释放，内存由 GC 管理，不可控
- 自定义包装类: 增加复杂度，无实际收益——ImageBitmap 本身就是零拷贝的高效对象

**理由**: ImageBitmap 是 Canvas 2D `drawImage()` 的原生参数类型，无需转换。`.close()` 后 `drawImage()` 静默无操作，天然防御竞态。

### 2. 内存估算方式

**选择**: `width * height * 4`（RGBA 4 bytes/pixel），与现有逻辑一致。

**变化**: 函数签名从 `estimateTextureBytes(texture: Texture)` 改为 `estimateImageBytes(image: ImageBitmap)`，直接读取 `image.width`/`image.height`。

### 3. 销毁策略

**选择**: 淘汰时直接调用 `image.close()`，一行代码。

**对比旧方案**:
- 旧: `source.resource.close()` → `source.resource = null` → `source.unload()` + try/catch 防御
- 新: `image.close()`

不需要 try/catch，`close()` 对已 close 的 ImageBitmap 是 no-op。

### 4. 类名和方法名重命名

| 旧名称 | 新名称 | 理由 |
|---------|--------|------|
| `TextureLRUCache` | `ImageLRUCache` | 不再是 Texture |
| `CacheEntry.texture` | `CacheEntry.image` | 语义准确 |
| `estimateTextureBytes` | `estimateImageBytes` | 参数类型变化 |
| `isTextureValid` | `isImageValid` | 语义一致 |
| `TextureWithVersion` | `ImageWithVersion` | 返回类型变化 |
| `loadTextureFromUrl` | `loadImageFromUrl` | 不再创建 Texture |
| `ImageLoader.loadTexture` | `ImageLoader.loadImage` | 语义一致 |
| `ImageLoader.evictTexture` | `ImageLoader.evictImage` | 语义一致 |
| `ImageLoader.textureCache` | `ImageLoader.imageCache` | 内部字段 |

### 5. 加载流程简化

```
旧: fetch → blob → createImageBitmap → new ImageSource({resource, alphaMode, autoGC}) → new Texture({source})
新: fetch → blob → createImageBitmap
```

移除 `ImageSource` 构造中的 `alphaMode: 'premultiply-alpha-on-upload'` 和 `autoGarbageCollect: false`。这些是 PixiJS GPU 上传配置，Canvas 2D 不需要。

## Risks / Trade-offs

**[编译期类型错误]** → Phase 1 完成后，消费者（InfiniteCanvas 等）使用 `Texture` 类型的代码会报错。这是预期行为，在 Phase 2/5 中修复。开发期间可用 `// @ts-ignore` 或分支隔离。

**[ImageBitmap.close() 后访问 width/height]** → close() 后 `width` 和 `height` 变为 0。如果有代码在 close 后读取尺寸做计算，会得到 0。缓解：LRU 淘汰时从 cache Map 中删除条目，后续不会再访问。

**[createImageBitmap 内存峰值]** → 与现有方案相同，无变化。大图解码时内存峰值不变。
