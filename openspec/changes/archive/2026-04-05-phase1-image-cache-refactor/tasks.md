## 1. 类型与接口改造

- [x] 1.1 移除 `import { Texture, ImageSource } from 'pixi.js'`，移除所有 PixiJS 类型引用
- [x] 1.2 将 `CacheEntry.texture: Texture` 改为 `CacheEntry.image: ImageBitmap`
- [x] 1.3 将 `TextureWithVersion` 重命名为 `ImageWithVersion`，字段从 `texture` 改为 `image`
- [x] 1.4 将 `estimateTextureBytes(texture: Texture)` 改为 `estimateImageBytes(image: ImageBitmap)`，读取 `image.width`/`image.height`

## 2. TextureLRUCache → ImageLRUCache

- [x] 2.1 类重命名为 `ImageLRUCache`
- [x] 2.2 `get(key)` 返回类型从 `Texture | undefined` 改为 `ImageBitmap | undefined`
- [x] 2.3 `set(key, texture)` 参数改为 `set(key, image: ImageBitmap)`，内部调用 `estimateImageBytes`
- [x] 2.4 `isTextureValid()` 重命名为 `isImageValid()`
- [x] 2.5 `clear()` 和 `_evictEntry()` 中的 `destroyTexture()` 调用改为直接 `image.close()`

## 3. 销毁与加载逻辑

- [x] 3.1 删除 `destroyTexture()` 函数（~20 行），替换为内联 `image.close()`
- [x] 3.2 将 `loadTextureFromUrl()` 改为 `loadImageFromUrl()`：移除 `new ImageSource` 和 `new Texture` 构造，直接返回 `ImageBitmap`

## 4. ImageLoader 类改造

- [x] 4.1 内部字段 `textureCache` 重命名为 `imageCache`，类型改为 `ImageLRUCache`
- [x] 4.2 `loadTexture()` 重命名为 `loadImage()`，返回类型改为 `ImageWithVersion | null`
- [x] 4.3 `reloadForZoomChange()` 回调参数类型从 `TextureWithVersion` 改为 `ImageWithVersion`
- [x] 4.4 `getCache()` 返回类型改为 `ImageLRUCache`
- [x] 4.5 `evictTexture()` 重命名为 `evictImage()`
- [x] 4.6 `doLoad()` 内部调用 `loadImageFromUrl` 替代 `loadTextureFromUrl`，返回 `ImageWithVersion`

## 5. 文件头注释更新

- [x] 5.1 更新文件顶部注释块，移除 PixiJS 相关描述，改为 ImageBitmap 缓存系统说明

## 6. 测试改造

- [x] 6.1 移除 `useImageLoader.test.ts` 中的 `pixi.js` mock（`vi.mock('pixi.js', ...)`）
- [x] 6.2 将测试中所有 `Texture` 相关的 mock 对象改为 `ImageBitmap` mock（`{ width, height, close: vi.fn() }`）
- [x] 6.3 将 `loadTexture` 调用改为 `loadImage`，`evictTexture` 改为 `evictImage`
- [x] 6.4 将 `TextureLRUCache` 引用改为 `ImageLRUCache`，`estimateTextureBytes` 改为 `estimateImageBytes`
- [x] 6.5 运行 `npx vitest run src/hooks/useImageLoader.test.ts` 确保所有测试通过
