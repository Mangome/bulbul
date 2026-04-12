## 1. 布局引擎重写

- [x] 1.1 重写 `src/utils/layout.ts` LayoutConfig 接口：移除 columns/maxSingleColumnWidth，新增 thumbnailSize/gap/groupTitleHeight，更新默认配置
- [x] 1.2 实现纵向行式网格布局算法 `computeVerticalGridLayout()`：所有分组纵向排列，组内按行排布缩略图，行高等于该行最高图的缩放高度
- [x] 1.3 实现 LayoutResult 接口：pages[] 含 offsetY（替代 offsetX），移除 totalWidth/pageWidth，统一 columnWidth
- [x] 1.4 实现空分组处理、缺失尺寸回退、最后一行居左排列
- [x] 1.5 导出 `computeHorizontalLayout` 为兼容别名指向新函数（或标记 deprecated）

## 2. 虚拟化简化

- [x] 2.1 重写 `src/utils/viewport.ts`：实现纯 Y 轴二分查找裁剪 `getVisibleItems()`，移除水平分组过滤 `getVisibleGroupRange()`
- [x] 2.2 更新 `ViewportRect` 计算：x 恒为 0，y = scrollY
- [x] 2.3 保留 `diffVisibleItems()` 增量 diff 逻辑不变

## 3. CanvasImageItem 缩略图模式

- [x] 3.1 修改 `src/components/canvas/CanvasImageItem.ts`：缩略图模式下隐藏底部信息覆盖层（不绘制渐变背景、文件名、Badge）
- [x] 3.2 移除悬停高亮效果（setHovered 设为 no-op，不绘制悬停边框和发光）
- [x] 3.3 简化选中效果：半透明蓝色遮罩 + 右上角小对勾，移除外发光和内描边

## 4. 分组标题启用

- [x] 4.1 修改 `src/components/canvas/GroupTitle.ts`：调整字体大小和间距适配缩略图模式
- [x] 4.2 在 InfiniteCanvas `renderFrame()` 中调用 `drawGroupTitles()` 渲染分组标题

## 5. InfiniteCanvas 纵向滚动重写

- [x] 5.1 移除水平分页状态：transitionStateRef、computeGroupX、applyGroupAlpha、ensureOnlyGroupVisible
- [x] 5.2 简化坐标系统：offsetX 恒为 0，offsetY = -scrollY * zoomLevel + verticalPadding，actualZoom = zoomLevel（无缩放补偿）
- [x] 5.3 重写滚轮事件：普通滚轮仅纵向滚动，Ctrl+滚轮缩放（Y 轴锚点）
- [x] 5.4 重写拖拽事件：仅纵向拖拽，移除水平拖拽逻辑
- [x] 5.5 重写 pointermove hitTest：命中后通知 Magnifier 组件
- [x] 5.6 实现 W/S 键纵向滚动到上/下一组（easeOutQuart 缓动，可中断）
- [x] 5.7 实现 scrollToGroup() imperative 方法
- [x] 5.8 集成 Magnifier 组件到 JSX

## 6. 悬浮放大镜组件

- [x] 6.1 新建 `src/components/canvas/Magnifier.tsx`：HTML overlay React 组件，absolute 定位
- [x] 6.2 实现放大镜定位策略：默认鼠标右上方，右侧空间不足翻转到左侧，上下边界自适应
- [x] 6.3 实现图片加载：HTML `<img>` 通过后端 URL 加载 medium 质量，加载前用缩略图占位
- [x] 6.4 实现信息面板：文件名、光圈、快门、ISO、焦距、合焦评分星级
- [x] 6.5 实现 fade-in/out 动画（150ms），设置 `pointer-events: none`
- [x] 6.6 拖拽期间自动隐藏放大镜

## 7. Store 状态简化

- [x] 7.1 修改 `src/stores/useCanvasStore.ts`：移除 isTransitioning 状态，简化 currentGroupIndex 更新逻辑
- [x] 7.2 实现 getCurrentGroupIndex()：根据 scrollY 在 layout pages 的 offsetY 中做二分查找
- [x] 7.3 更新 prevGroup/nextGroup：改为计算目标组的 offsetY 并设置 scrollY

## 8. 下游适配与测试

- [x] 8.1 适配 FloatingGroupList：分组切换改为设置 scrollY 到目标组位置
- [x] 8.2 适配 FloatingControlBar：fitToWindow 计算基于纵向内容高度
- [x] 8.3 更新 `src/hooks/useImageLoader.ts`：缩略图默认加载 thumbnail 质量
- [x] 8.4 更新布局调用处：替换 computeHorizontalLayout 为新的布局函数
- [x] 8.5 验证 TypeScript 类型检查通过
- [x] 8.6 验证前端测试通过
