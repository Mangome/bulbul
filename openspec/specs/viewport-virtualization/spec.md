## Requirements

### Requirement: 虚拟化视口变换计算
系统 SHALL 基于 Canvas 2D 坐标系（scrollY/zoomLevel）计算视口矩形，用于虚拟化判定。

#### Scenario: ViewportRect 计算基于纵向滚动坐标系
- **WHEN** updateViewport() 执行
- **THEN** 根据 scrollY、zoomLevel、screenWidth、screenHeight 计算 viewportRect：
  - **AND** `viewportRect.x = 0`（内容水平居中，视口 X 起始为 0）
  - **AND** `viewportRect.y = scrollY`
  - **AND** `viewportRect.width = screenWidth / zoomLevel`
  - **AND** `viewportRect.height = screenHeight / zoomLevel`

#### Scenario: 纯 Y 轴二分查找裁剪
- **WHEN** getVisibleItems() 调用
- **THEN** 系统 SHALL 在所有 items（按 Y 排序）上做二分查找，确定视口 Y 范围内的可见项
- **AND** 缓冲区上下各扩展 1 屏高度
- **AND** 不再进行水平分组过滤

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
