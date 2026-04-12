## Why

当前画布以大图水平分页方式展示每个分组的图片（每组2列瀑布流），当组内图片较多时，需要大量纵向滚动才能看完整组内容，辨别相似图片的效率很低。需要改为高密度缩略图网格展示，配合鼠标悬浮放大镜快速确认细节，从根本上提升图片筛选效率。

## What Changes

- **BREAKING**: 布局引擎从水平分页2列瀑布流改为纵向行式网格布局，所有分组纵向排列
- **BREAKING**: 坐标系统从 offsetX + offsetY + actualZoom（含缩放补偿）简化为 scrollY + zoomLevel 纯纵向滚动
- **BREAKING**: 虚拟化从水平分组过滤 + 组内Y轴裁剪简化为纯Y轴裁剪
- 新增悬浮放大镜组件：鼠标悬停缩略图时在旁边弹出大图预览窗口，显示文件名、拍摄参数、合焦评分
- CanvasImageItem 缩略图模式绘制简化：移除信息覆盖层和悬停效果，选中效果简化
- 启用分组标题渲染（当前 GroupTitle 代码存在但未调用）
- 键盘交互从 W/S 水平切换改为纵向滚动到上/下一组
- useCanvasStore 移除水平分页相关状态（isTransitioning、transitionState 等）

## Capabilities

### New Capabilities
- `magnifier-overlay`: 悬浮放大镜组件，鼠标悬停缩略图时显示大图预览窗口及图片信息
- `thumbnail-grid-layout`: 纵向行式缩略图网格布局引擎，替代原有水平分页瀑布流布局

### Modified Capabilities
- `infinite-canvas`: 坐标系统简化为纵向滚动，移除水平分页切换动画和缩放补偿
- `viewport-virtualization`: 简化为纯Y轴二分查找裁剪，移除水平分组过滤
- `canvas-image-item`: 缩略图模式绘制简化，移除信息覆盖层和悬停效果
- `keyboard-shortcuts`: W/S 键从水平分组切换改为纵向滚动到上/下一组
- `waterfall-layout`: 整体替换为缩略图网格布局引擎

## Impact

- **核心文件重写**: `layout.ts`、`viewport.ts`、`InfiniteCanvas.tsx`
- **组件修改**: `CanvasImageItem.ts`（绘制简化）、`GroupTitle.ts`（启用渲染）
- **新建组件**: `Magnifier.tsx`（HTML overlay 悬浮放大镜）
- **状态变更**: `useCanvasStore.ts` 移除 isTransitioning、transitionState，简化滚动逻辑
- **图片加载**: 缩略图默认加载 thumbnail 质量；放大镜通过 HTML `<img>` 独立加载 medium 质量
- **下游影响**: `FloatingGroupList`（分组导航UI）需适配纵向滚动模式
