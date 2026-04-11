## ADDED Requirements

### Requirement: 分组切换动画启动
系统应该在用户选择新分组时启动 400ms 的平滑切换动画。

#### Scenario: 动画准备阶段
- **WHEN** 用户选择新分组（通过 UI 或 W/S 快捷键）
- **THEN** InfiniteCanvas 中止当前的 rAF
- **AND** 创建两个 OffscreenCanvas（分辨率与 viewport 一致）
- **AND** 绘制旧分组所有可见 item 到 offscreenA
- **AND** 绘制新分组所有可见 item 到 offscreenB（或用占位色块 fallback）
- **AND** 开始动画计时，transitionAnimRef = requestAnimationFrame(animateTransition)

#### Scenario: 动画进行阶段
- **WHEN** 动画时间 t ∈ [0, 400ms]
- **THEN** 计算 eased progress: p = easeOutQuart(t / 400) = 1 - pow(1 - t / 400, 4)
- **AND** 清空 Canvas，绘制背景
- **AND** ctx.globalAlpha = 1 - p，绘制 offscreenA（旧分组淡出）
- **AND** ctx.globalAlpha = p，绘制 offscreenB（新分组淡入）
- **AND** 可选：水平位移动画（offscreenA 向左、offscreenB 从右滑入）
- **AND** 调用 updateViewport() 为新分组预加载 item

#### Scenario: 动画结束阶段
- **WHEN** 动画完成（t >= 400ms）或被取消
- **THEN** cancelAnimationFrame(transitionAnimRef)
- **AND** 释放两个 OffscreenCanvas 和 2D context
- **AND** setTransitioning(false)
- **AND** ensureOnlyGroupVisible(newGroupIndex)
- **AND** 回到按需渲染模式，markDirty() 如有脏状态

#### Scenario: 动画期间快速切组
- **WHEN** 动画进行中用户再次切组
- **THEN** 当前动画被取消
- **AND** 新的动画流程启动，以当前可见分组为起点

### Requirement: 降级渲染（目标分组未完全加载）
系统应该支持当新分组的图片尚未全部加载时的降级渲染。

#### Scenario: 新分组部分已加载
- **WHEN** offscreenB 的一些 item 已加载图片，但部分仍为占位色块
- **THEN** 动画仍正常进行
- **AND** 图片逐个加载完成后，对应 item 自动更新显示
- **AND** 如需求刷新，markDirty() 被调用

#### Scenario: 新分组完全未加载
- **WHEN** offscreenB 的所有 item 都是占位色块
- **THEN** 动画显示旧分组淡出、新分组（占位色块）淡入
- **AND** 用户看到灰色网格过渡，而非黑屏

### Requirement: 尊重用户偏好 prefers-reduced-motion
系统应该检测用户是否启用了"减少动画"偏好，若启用则动画时长设为 0（直接跳转）。

#### Scenario: 用户启用减少动画偏好
- **WHEN** window.matchMedia('(prefers-reduced-motion: reduce)').matches === true
- **THEN** 分组切换动画时长设为 0
- **AND** 动画直接结束，新分组立即显示

#### Scenario: 用户未启用减少动画偏好
- **WHEN** prefers-reduced-motion 不匹配或为 no-preference
- **THEN** 分组切换动画时长使用标准值 400ms

### Requirement: 动画与主题切换
系统应该处理动画进行中主题切换的边界情况。

#### Scenario: 动画中切换主题
- **WHEN** 分组切换动画进行中用户切换主题
- **THEN** 当前动画继续执行，OffscreenCanvas 保持原有内容
- **AND** 动画结束后，新主题应用于 Canvas 背景（DotBackground.updateTheme()）
- **AND** markDirty() 重新渲染

### Requirement: 离屏 Canvas 大小管理
系统应该为离屏 Canvas 分配合适的大小，并在视口变化时更新。

#### Scenario: 创建离屏 Canvas
- **WHEN** 动画准备时创建 OffscreenCanvas
- **THEN** 宽度 = 当前 viewport 物理宽度 * dpr
- **AND** 高度 = 当前可见高度 * dpr
- **AND** getContext('2d') 返回有效 context

#### Scenario: 离屏 Canvas 被回收
- **WHEN** 动画结束或取消
- **THEN** OffscreenCanvas 对象被释放
- **AND** 无内存泄漏

### Requirement: 动画中的事件处理
系统应该在动画进行中处理用户事件（禁止或延迟）。

#### Scenario: 动画中禁止点击选中
- **WHEN** isTransitioning === true 且用户点击 item
- **THEN** 点击事件被忽略或延迟到动画结束后
- **AND** 避免选中状态不一致

#### Scenario: 动画中允许滚轮/拖拽
- **WHEN** 动画进行中用户滚轮或拖拽
- **THEN** 判断是否应该中断动画或继续执行
- **AND** 可选策略：中断动画立即切回新分组，或继续动画同时处理滚轮
