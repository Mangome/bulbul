## MODIFIED Requirements

### Requirement: ImageBitmap 缓存的销毁无竞态保证
ImageBitmap LRU 缓存在 Phase 1 中完成迁移，Phase 5 需要确保在 CanvasImageItem 销毁时，已关闭的 ImageBitmap 不会导致渲染崩溃。

#### Scenario: ImageBitmap 销毁后 drawImage 仍安全
- **WHEN** imageLoader.evictImage(hash) 被调用，ImageBitmap.close() 执行
- **AND** CanvasImageItem 仍在 Canvas 上调用 draw(ctx, ...)
- **THEN** ctx.drawImage(closedBitmap, ...) 不抛异常
- **AND** 静默无操作（无像素绘制）
- **AND** 渲染继续正常进行，无崩溃

#### Scenario: LRU 缓存淘汰触发 ImageBitmap.close()
- **WHEN** 缓存条目被淘汰（达到容量限制）
- **THEN** 调用 bitmap.close()
- **AND** 后续任何引用该 bitmap 的 CanvasImageItem 继续安全工作（可能显示占位色块）
