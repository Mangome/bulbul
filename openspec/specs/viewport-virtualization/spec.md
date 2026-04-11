## MODIFIED Requirements

### Requirement: 虚拟化视口变换计算

系统 SHALL 基于 Canvas 2D 坐标系（offsetX/offsetY/actualZoom）计算视口矩形，用于虚拟化判定。

#### Scenario: ViewportRect 计算基于 Canvas 2D 坐标系

- **WHEN** updateViewport() 执行
- **THEN** 根据 offsetX、offsetY、actualZoom、screenWidth、screenHeight 计算 viewportRect：
  - **AND** `viewportRect.x = -offsetX / actualZoom`
  - **AND** `viewportRect.y = -offsetY / actualZoom`
  - **AND** `viewportRect.width = screenWidth / actualZoom`
  - **AND** `viewportRect.height = screenHeight / actualZoom`

#### Scenario: 虚拟化算法保持不变

- **WHEN** getVisibleItems() 调用
- **THEN** 使用现有算法计算可见 item 集合（仅坐标系统改变，算法逻辑不变）

#### Scenario: Diff 操作继续预加载/卸载

- **WHEN** diffVisibleItems 返回 enter/leave 集合
- **THEN** enter 中的 item 创建并异步加载
- **AND** leave 中的 item 销毁并缓存卸载

### Requirement: ImageBitmap LRU 缓存

系统 SHALL 使用 `ImageLRUCache` 管理 ImageBitmap 生命周期，控制同时加载的图片数量和内存占用。缓存细节由 [image-bitmap-cache 规范](../image-bitmap-cache/spec.md) 定义。

#### Scenario: 缓存命中

- **WHEN** 请求加载已在缓存中的 ImageBitmap
- **THEN** 系统 SHALL 直接返回缓存 ImageBitmap，更新其 LRU 访问时间

#### Scenario: ImageBitmap 异步加载

- **WHEN** 请求加载不在缓存中的图片
- **THEN** 系统 SHALL 异步加载 ImageBitmap，加载完成前显示占位色块

#### Scenario: 缓存淘汰时释放内存

- **WHEN** 缓存条目数或内存占用达到上限
- **THEN** 系统 SHALL 淘汰最久未使用的 ImageBitmap，调用 `image.close()` 释放内存
