## Why

当前 Magnifier 组件以弹出窗口形式展示整张 medium 质量图片和元数据，不符合"放大镜"直觉：用户期望鼠标控制一个局部放大视窗，拖动查看对应区域的细节，类似相机监视器的对焦放大效果。

## What Changes

- **移除** Magnifier 弹出预览组件（整图 + 元数据面板）
- **新增** Loupe 放大镜组件：方形圆角视窗，跟随鼠标显示对应位置的全图放大区域
- **新增** 滚轮调节放大倍率功能（放大镜可见时普通滚轮调倍率，Ctrl+滚轮仍控制画布缩放）
- **修改** InfiniteCanvas 的指针事件和滚轮事件处理，传递缩略图位置信息给 Loupe
- **修改** CanvasImageItem 新增 `getHeight()` 公共访问器

## Capabilities

### New Capabilities
- `loupe-magnifier`: 放大镜交互组件——方形视窗跟随鼠标，显示鼠标位置对应的全图放大区域，支持滚轮调节倍率

### Modified Capabilities
- `infinite-canvas`: 悬停交互从 Magnifier 切换为 Loupe，滚轮事件新增放大镜倍率调节分支

## Impact

- **组件替换**: `Magnifier.tsx` → `Loupe.tsx` + `Loupe.module.css`
- **事件处理变更**: InfiniteCanvas 的 handlePointerMove 需传递 itemRect，handleWheel 需区分放大镜倍率调节
- **CanvasImageItem**: 新增 `getHeight()` 方法
- **图片加载**: Loupe 独立加载 medium ImageBitmap + 离屏 canvas 预旋转 EXIF orientation
