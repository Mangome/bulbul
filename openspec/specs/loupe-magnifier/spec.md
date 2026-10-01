## Requirements

### Requirement: Loupe 放大镜组件
系统 SHALL 提供 Loupe React 组件，以 HTML overlay 形式在画布容器内显示方形圆角放大镜视窗，展示鼠标位置对应的全图放大区域。

#### Scenario: 放大镜视窗外观
- **WHEN** Loupe 组件可见
- **THEN** 渲染一个 200x200px 方形圆角视窗（12px border-radius）
- **AND** 视窗带 1px 边框和阴影
- **AND** 视窗右下角显示当前放大倍率标签（格式如 "3.0x"）

#### Scenario: 放大镜位置跟随鼠标
- **WHEN** 鼠标在缩略图上移动
- **THEN** 放大镜视窗出现在鼠标右上方（偏移 20px 右，10px 上）
- **AND** 右侧空间不足时翻转到左侧
- **AND** 上方空间不足时出现在下方
- **AND** 始终不超出画布视口边界

#### Scenario: 坐标映射与内容显示
- **WHEN** 鼠标在缩略图上的相对位置为 (relX, relY)
- **THEN** 放大镜显示 medium 质量图片中对应 (relX * imageWidth, relY * imageHeight) 位置的放大区域
- **AND** 源区域以该映射点为中心，大小由放大倍率决定
- **AND** 源区域 clamp 到图像边界，不显示黑边

#### Scenario: EXIF orientation 处理
- **WHEN** 图片的 EXIF orientation 为 5-8（纵向图片）
- **THEN** 放大镜显示的放大区域 SHALL 经过正确的旋转/镜像变换
- **AND** 坐标映射基于旋转后的逻辑尺寸（metadata.imageWidth/Height）

#### Scenario: DPR 高清渲染
- **WHEN** 设备 devicePixelRatio > 1
- **THEN** 放大镜内部 canvas 物理尺寸为 LOUPE_SIZE × dpr
- **AND** CSS 尺寸为 LOUPE_SIZE
- **AND** 绘制前 ctx.scale(dpr, dpr) 确保清晰

#### Scenario: 图片加载
- **WHEN** Loupe 组件接收到新的 hash
- **THEN** 通过 imageService.getImageUrl(hash, 'medium') 加载 medium 质量 ImageBitmap
- **AND** 创建离屏 canvas 预旋转 EXIF orientation
- **AND** medium 图加载中时显示空白背景

#### Scenario: 资源释放
- **WHEN** hash 变化或组件卸载
- **THEN** 旧的 medium ImageBitmap SHALL 调用 close() 释放
- **AND** 离屏 canvas 引用 SHALL 置空

### Requirement: 放大镜倍率调节
系统 SHALL 支持通过滚轮调节放大镜倍率，范围 1.5x 到 10x。

#### Scenario: 默认倍率
- **WHEN** Loupe 组件首次显示
- **THEN** 放大倍率 SHALL 为 3.0x

#### Scenario: 滚轮调节倍率
- **WHEN** 放大镜可见且用户滚动普通滚轮
- **THEN** 放大倍率 SHALL 按乘法式调节：newMag = oldMag * (1 - deltaY * 0.005)
- **AND** 倍率 SHALL 限制在 [1.5, 10] 范围内
- **AND** 倍率变化时放大镜内容 SHALL 立即更新

#### Scenario: Ctrl+滚轮不调节倍率
- **WHEN** 放大镜可见且用户按住 Ctrl 键滚动滚轮
- **THEN** 画布正常响应，放大镜倍率不变

### Requirement: 放大镜显示/隐藏过渡
系统 SHALL 提供放大镜显示和隐藏的淡入淡出过渡效果。

#### Scenario: 淡入
- **WHEN** 鼠标进入缩略图区域
- **THEN** 放大镜 SHALL 在 150ms 内从 opacity 0 淡入到 opacity 1

#### Scenario: 淡出
- **WHEN** 鼠标离开缩略图区域
- **THEN** 放大镜 SHALL 在 100ms 内从 opacity 1 淡出到 opacity 0

#### Scenario: 拖拽时隐藏
- **WHEN** 用户开始拖拽画布
- **THEN** 放大镜 SHALL 立即淡出

#### Scenario: prefers-reduced-motion
- **WHEN** 系统偏好设置 reduced-motion
- **THEN** 淡入淡出时长 SHALL 为 0ms（立即显示/隐藏）

### Requirement: 放大镜触发方式（悬停 / 长按）
系统 SHALL 支持两种放大镜触发方式：悬停触发（默认开启，本地设置 `magnifierOnHover` = true，无需按下鼠标）与长按/拖拽触发。关闭悬停触发后，行为 SHALL 与仅支持长按/拖拽时一致。

#### Scenario: 悬停显示放大镜
- **WHEN** magnifierOnHover 为 true 且鼠标停在缩略图上超过 150ms
- **THEN** 放大镜 SHALL 显示并跟随鼠标位置实时更新
- **AND** 鼠标移到图片外的空白区或画布外区域时 SHALL 隐藏并清除缩略图上的源区域方框

#### Scenario: 快速扫过不触发
- **WHEN** 鼠标在 150ms 内连续掠过多个缩略图
- **THEN** 放大镜 SHALL 不显示（避免反复解码 medium 图）

#### Scenario: 滚动时隐藏
- **WHEN** 悬停放大镜可见且用户滚动滚轮
- **THEN** 画布 SHALL 正常纵向滚动，悬停放大镜 SHALL 隐藏（避免显示滚动前的旧区域）

#### Scenario: 关闭悬停触发
- **WHEN** magnifierOnHover 为 false
- **THEN** 悬停 SHALL 不显示放大镜
- **AND** 长按（300ms）或按住拖拽缩略图 SHALL 显示放大镜，松开鼠标后隐藏
- **AND** 首次悬停缩略图时 SHALL 显示「长按查看细节」提示

#### Scenario: 设置持久化
- **WHEN** 用户切换悬停放大镜开关后关闭应用
- **THEN** 下次启动时 magnifierOnHover SHALL 恢复为上次设置的值
