## Requirements

### Requirement: ImageBitmap LRU 缓存
系统 SHALL 提供基于 `ImageBitmap` 的 LRU 缓存（`ImageLRUCache`），利用 `Map` 插入顺序实现 LRU 淘汰，同时跟踪内存估算值。缓存 SHALL 支持容量上限（条目数）和内存上限（字节数）双重限制。

#### Scenario: 缓存命中时更新 LRU 顺序
- **WHEN** 调用 `get(key)` 且 key 存在于缓存中
- **THEN** 返回对应的 `ImageBitmap`，并将该条目移至最近使用位置

#### Scenario: 缓存未命中
- **WHEN** 调用 `get(key)` 且 key 不存在于缓存中
- **THEN** 返回 `undefined`

#### Scenario: 存入时超出容量上限
- **WHEN** 调用 `set(key, image)` 且缓存条目数已达 `capacity`
- **THEN** 淘汰最久未使用的条目（Map 头部），对被淘汰的 `ImageBitmap` 调用 `.close()`

#### Scenario: 存入时超出内存上限
- **WHEN** 调用 `set(key, image)` 且 `currentMemory + newImageBytes > memoryLimit`
- **THEN** 持续淘汰最久未使用的条目直到内存充足，每次淘汰都调用 `ImageBitmap.close()`

#### Scenario: 覆盖已有 key
- **WHEN** 调用 `set(key, image)` 且 key 已存在
- **THEN** 销毁旧的 `ImageBitmap`（`.close()`），替换为新的，更新内存估算

### Requirement: ImageBitmap 内存估算
系统 SHALL 通过 `estimateImageBytes(image: ImageBitmap)` 函数估算单个 ImageBitmap 的内存占用，公式为 `width * height * 4`（RGBA 4 bytes/pixel）。

#### Scenario: 正常尺寸图片
- **WHEN** 传入 width=1920, height=1080 的 ImageBitmap
- **THEN** 返回 `1920 * 1080 * 4 = 8294400` 字节

#### Scenario: 零尺寸图片
- **WHEN** 传入 width=0 或 height=0 的 ImageBitmap
- **THEN** 返回 0

### Requirement: ImageBitmap 安全销毁
系统 SHALL 通过调用 `ImageBitmap.close()` 释放内存。销毁后如果有代码调用 `ctx.drawImage(closedBitmap, ...)`，SHALL 静默无操作（不抛异常）。

#### Scenario: 正常销毁
- **WHEN** LRU 缓存淘汰一个条目
- **THEN** 对该条目的 `ImageBitmap` 调用 `.close()`，`currentMemory` 减去对应字节数

#### Scenario: 销毁后绘制
- **WHEN** 已 close 的 ImageBitmap 被传给 `ctx.drawImage()`
- **THEN** 不抛出异常，不绘制任何内容（Canvas 2D 规范行为）

### Requirement: 从 URL 加载 ImageBitmap
系统 SHALL 提供 `loadImageFromUrl(url: string): Promise<ImageBitmap>` 函数，通过 `fetch → blob → createImageBitmap` 加载图片，不依赖任何第三方渲染框架。

#### Scenario: 加载成功
- **WHEN** 传入有效的图片 URL
- **THEN** 返回 `ImageBitmap` 对象

#### Scenario: 加载失败（HTTP 错误）
- **WHEN** fetch 返回非 2xx 状态码
- **THEN** 抛出包含 URL 和状态码的 Error

### Requirement: ImageLoader 加载去重
`ImageLoader` SHALL 通过 `pending` Map 对同一 key 的并发加载请求去重。同一 key 的多次 `loadImage()` 调用 SHALL 共享同一个 Promise。

#### Scenario: 并发请求同一图片
- **WHEN** 对同一 hash + displayWidth 连续调用两次 `loadImage()`，第一次尚未完成
- **THEN** 第二次调用返回与第一次相同的 Promise，不发起新的 fetch

#### Scenario: 请求完成后再次请求
- **WHEN** 第一次 `loadImage()` 已完成并缓存，再次调用
- **THEN** 直接从缓存返回，不进入 pending 流程

### Requirement: 缩放质量选择
系统 SHALL 根据 `displayWidth` 选择加载质量：`displayWidth > 200` 时加载 `medium`，否则加载 `thumbnail`。函数 `getSizeForDisplay(displayWidth)` SHALL 返回 `'medium'` 或 `'thumbnail'`。

#### Scenario: 大尺寸显示
- **WHEN** displayWidth = 400
- **THEN** `getSizeForDisplay()` 返回 `'medium'`

#### Scenario: 小尺寸显示
- **WHEN** displayWidth = 150
- **THEN** `getSizeForDisplay()` 返回 `'thumbnail'`

#### Scenario: 边界值
- **WHEN** displayWidth = 200
- **THEN** `getSizeForDisplay()` 返回 `'thumbnail'`（不大于 200）

### Requirement: 缓存版本验证
系统 SHALL 为每个缓存 key 维护递增的版本号。`isImageValid(key, version)` 方法 SHALL 在 key 存在且版本号匹配时返回 `true`，用于异步加载完成后验证缓存条目是否仍有效（未被淘汰后重新加载）。

#### Scenario: 版本匹配
- **WHEN** 调用 `isImageValid(key, version)` 且 key 存在、version 等于当前版本
- **THEN** 返回 `true`

#### Scenario: 版本不匹配（已被淘汰重加载）
- **WHEN** 调用 `isImageValid(key, version)` 且 version 小于当前版本
- **THEN** 返回 `false`

#### Scenario: key 不存在
- **WHEN** 调用 `isImageValid(key, version)` 且 key 不在缓存中
- **THEN** 返回 `false`

### Requirement: 缩放变更批量重加载
`ImageLoader.reloadForZoomChange()` SHALL 接收一组 `{hash, displayWidth}` 条目，对每个条目检查缓存命中，未命中则异步加载，加载完成后通过回调通知调用方。

#### Scenario: 部分命中部分未命中
- **WHEN** 传入 3 个条目，其中 1 个已缓存、2 个未缓存
- **THEN** 已缓存的立即回调，未缓存的异步加载后回调，所有完成后 Promise resolve

### Requirement: 无 PixiJS 依赖
`useImageLoader.ts` SHALL 不导入任何 `pixi.js` 模块。所有类型（`Texture`、`ImageSource`）和 API（`Assets.load`、`source.unload`）SHALL 被移除。

#### Scenario: 编译检查
- **WHEN** 对 `useImageLoader.ts` 单独进行 import 分析
- **THEN** 不包含任何 `from 'pixi.js'` 导入
