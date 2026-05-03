## Purpose

提供 RGB 直方图计算、存储和画布绘制的完整能力，支持后端计算、元数据缓存和前端叠加渲染。

## Requirements

### Requirement: 后端 RGB 直方图计算
系统 SHALL 在后端图片处理阶段（`raw_processor::process_single_image`）对 `DynamicImage` 计算 RGB 三通道直方图，每通道 256 bins（`Vec<u32>`，长度 256）。计算 SHALL 在 `generate_medium()` 之前执行，零额外 IO。

#### Scenario: 正常图片直方图计算
- **WHEN** 后端处理一张 NEF 图片并解码为 `DynamicImage`
- **THEN** SHALL 遍历所有像素，按 R/G/B 通道分别计数，生成三个长度为 256 的 `Vec<u32>`

#### Scenario: 直方图计算性能
- **WHEN** 计算 medium 尺寸图片（最大 2560px）的直方图
- **THEN** 单张计算耗时 SHALL 不超过 5ms

### Requirement: 直方图数据存入 ImageMetadata
直方图数据 SHALL 作为 `ImageMetadata` 的一部分存储和传输，随元数据缓存持久化到磁盘。

#### Scenario: 直方图字段序列化
- **WHEN** ImageMetadata 被序列化为 JSON
- **THEN** SHALL 包含 `histogram_r`、`histogram_g`、`histogram_b` 三个数组字段，每个为 256 个 u32 元素

#### Scenario: 旧缓存兼容
- **WHEN** 读取由旧系统生成的元数据（无直方图字段）
- **THEN** 直方图字段 SHALL 默认为空数组 `[]`

#### Scenario: IPC 传输
- **WHEN** 前端通过 `get_metadata` 或 `get_batch_metadata` 获取元数据
- **THEN** 返回数据 SHALL 包含 `histogramR`、`histogramG`、`histogramB` 字段（camelCase）

### Requirement: 前端画布直方图绘制
CanvasImageItem SHALL 在图片底部绘制 RGB 叠加直方图，当 `showHistogram` 为 true 且直方图数据可用时显示。

#### Scenario: 显示直方图
- **WHEN** `showHistogram` 为 true 且图片有直方图数据
- **THEN** SHALL 在图片底部渐变背景区域内绘制 RGB 三通道叠加直方图

#### Scenario: 隐藏直方图
- **WHEN** `showHistogram` 为 false
- **THEN** SHALL 不绘制直方图

#### Scenario: 无直方图数据
- **WHEN** `showHistogram` 为 true 但图片无直方图数据（旧缓存）
- **THEN** SHALL 不绘制直方图区域，不影响其他覆盖层

#### Scenario: 直方图视觉规格
- **WHEN** 直方图被绘制
- **THEN** SHALL 使用半透明红/绿/蓝填充，高度约 40 屏幕像素
- **AND** SHALL 使用反向缩放补偿（invZoom），确保视觉大小不随缩放变化
- **AND** SHALL 在信息覆盖层文字上方绘制

#### Scenario: 直方图与信息覆盖层共存
- **WHEN** `showHistogram` 和 `showImageInfo` 均为 true
- **THEN** 直方图 SHALL 绘制在信息覆盖层文字上方，渐变背景高度 SHALL 自适应两者内容

### Requirement: 直方图数据传递到 CanvasImageItem
InfiniteCanvas SHALL 在图片进入视口时将直方图数据传递给 CanvasImageItem。

#### Scenario: 设置直方图数据
- **WHEN** 图片的元数据加载完成且包含直方图数据
- **THEN** SHALL 调用 CanvasImageItem 的方法设置直方图数据

#### Scenario: 清除直方图数据
- **WHEN** 图片离开视口被销毁
- **THEN** CanvasImageItem 的直方图数据引用 SHALL 被清除
