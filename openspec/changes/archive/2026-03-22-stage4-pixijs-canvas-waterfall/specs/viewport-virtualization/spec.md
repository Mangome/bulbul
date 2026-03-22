## ADDED Requirements

### Requirement: 视口裁剪
系统 SHALL 仅渲染视口内（含缓冲区）的图片项，视口外的图片项 SHALL 不创建 PixiJS 对象或及时销毁。

#### Scenario: 可见元素判定
- **WHEN** 视口矩形更新
- **THEN** 系统计算与视口（含缓冲区）相交的 LayoutItem 集合，缓冲区为视口高度的 50%

#### Scenario: 进入视口
- **WHEN** 某个 LayoutItem 从视口外进入视口（含缓冲区）
- **THEN** 系统 SHALL 创建对应的 CanvasImageItem 并添加到 ContentLayer

#### Scenario: 离开视口
- **WHEN** 某个 CanvasImageItem 完全离开视口（含缓冲区）
- **THEN** 系统 SHALL 从 ContentLayer 移除该对象并释放其纹理引用

### Requirement: 纹理 LRU 缓存
系统 SHALL 维护一个 LRU 纹理缓存，控制同时加载的 GPU 纹理数量。

#### Scenario: 缓存容量上限
- **WHEN** 缓存中的纹理数量达到 300
- **THEN** 加载新纹理时 SHALL 淘汰最久未使用的纹理，调用 `texture.destroy()` 释放 GPU 内存

#### Scenario: 缓存命中
- **WHEN** 请求加载已在缓存中的纹理
- **THEN** 系统 SHALL 直接返回缓存纹理，更新其 LRU 访问时间

#### Scenario: 纹理异步加载
- **WHEN** 请求加载不在缓存中的纹理
- **THEN** 系统 SHALL 异步加载图片，加载完成前显示占位色块

### Requirement: 分级加载
系统 SHALL 根据当前缩放级别选择加载不同分辨率的图片。

#### Scenario: 低缩放使用 thumbnail
- **WHEN** 缩放级别 < 50%
- **THEN** 系统 SHALL 加载 thumbnail（200px 宽）图片

#### Scenario: 高缩放使用 medium
- **WHEN** 缩放级别 ≥ 50%
- **THEN** 系统 SHALL 加载 medium（~1080p）图片

#### Scenario: 缩放阈值切换
- **WHEN** 缩放级别跨越 50% 阈值
- **THEN** 系统 SHALL 对视口内所有图片项重新加载对应分辨率的纹理
