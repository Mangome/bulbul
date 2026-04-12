## 1. CanvasImageItem 准备

- [x] 1.1 在 CanvasImageItem 中新增 `getHeight()` 公共方法

## 2. Loupe 组件创建

- [x] 2.1 创建 `Loupe.module.css`：container 定位、canvas 圆角阴影、倍率标签样式
- [x] 2.2 创建 `Loupe.tsx`：定义 Props 和 LoupeHandle 接口
- [x] 2.3 实现 medium ImageBitmap 加载逻辑（hash 变化时加载、释放旧资源）
- [x] 2.4 实现离屏 canvas 预旋转 EXIF orientation（复用 CanvasImageItem._drawImageWithOrientation 变换逻辑）
- [x] 2.5 实现坐标映射和放大源区域计算（屏幕→内容→相对→medium 逻辑坐标→源区域 + 边界 clamp）
- [x] 2.6 实现 loupe canvas 绘制逻辑（drawImage 裁切 + DPR 处理）
- [x] 2.7 实现放大镜定位计算（鼠标右上方偏移 + 边界自适应翻转）
- [x] 2.8 实现淡入淡出过渡（150ms 淡入、100ms 淡出、prefers-reduced-motion 支持）
- [x] 2.9 实现 `adjustMagnification(deltaY)` imperative 方法（乘法式调节，范围 1.5-10，默认 3.0）
- [x] 2.10 实现 useImperativeHandle 暴露 LoupeHandle

## 3. InfiniteCanvas 集成

- [x] 3.1 扩展 magnifierState 类型，新增 `itemRect` 字段
- [x] 3.2 修改 handlePointerMove：hitTest 命中时将 item 的 x/y/width/height 传入 magnifierState
- [x] 3.3 修改 handleWheel：放大镜可见时普通滚轮调用 loupeRef.adjustMagnification()
- [x] 3.4 替换 JSX 中 `<Magnifier>` 为 `<Loupe>`，传递新增 props（itemRect、zoom、scrollY）
- [x] 3.5 添加 loupeRef 引用

## 4. 清理

- [x] 4.1 删除 `Magnifier.tsx`
- [x] 4.2 移除 InfiniteCanvas 中对 Magnifier 的 import

## 5. 验证

- [x] 5.1 运行 TypeScript 类型检查 (`npx tsc --noEmit`)
- [x] 5.2 运行前端测试 (`npx vitest run`)
- [ ] 5.3 手动验证：缩略图悬停放大镜显示、鼠标移动放大区域跟随、滚轮调节倍率、纵向图片 EXIF 正确、边界无黑边
