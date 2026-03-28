## MODIFIED Requirements

### Requirement: 纹理 LRU 缓存

系统 SHALL 维护一个 LRU 纹理缓存，控制同时加载的 GPU 纹理数量和内存占用。

#### Scenario: 缓存容量上限

- **WHEN** 缓存中的纹理数量达到 300
- **THEN** 加载新纹理时 SHALL 淘汰最久未使用的纹理，调用 `texture.destroy()` 释放 GPU 内存

#### Scenario: 内存上限控制

- **WHEN** 缓存纹理的估算总内存占用接近 300MB
- **THEN** 系统 SHALL 优先淘汰大尺寸纹理（medium），即使未达到数量上限

#### Scenario: 缓存命中

- **WHEN** 请求加载已在缓存中的纹理
- **THEN** 系统 SHALL 直接返回缓存纹理，更新其 LRU 访问时间

#### Scenario: 纹理异步加载

- **WHEN** 请求加载不在缓存中的纹理
- **THEN** 系统 SHALL 异步加载图片，加载完成前显示占位色块

#### Scenario: 纹理内存估算

- **WHEN** 加载一张纹理到缓存
- **THEN** 系统 SHALL 基于纹理像素尺寸估算 GPU 内存占用（width x height x 4 bytes）
