## 1. 基础类结构

- [x] 1.1 创建新的 `CanvasImageItem` 类骨架：构造函数接收 `LayoutItem`，定义所有属性（hash, groupId, x, y, width, height, alpha, image, orientation），移除所有 PixiJS 导入和继承
- [x] 1.2 实现 `setImage(image: ImageBitmap, orientation?: number)` 方法
- [x] 1.3 实现 `setImageInfo(fileName, metadata)` 方法，预计算 Badge 布局数据并缓存
- [x] 1.4 实现 `hitTest(contentX, contentY)` AABB 命中检测
- [x] 1.5 实现 `destroy()` 方法：清理内部状态，不触碰 ImageBitmap

## 2. 核心绘制 — draw() 方法

- [x] 2.1 实现 `draw(ctx, zoom, now)` 方法框架：alpha 检查、ctx.save/translate/globalAlpha、返回 needsNextFrame
- [x] 2.2 实现占位色块绘制（`#E0E4EB` 填充矩形）
- [x] 2.3 实现 `drawImageWithOrientation()` 函数：8 种 EXIF Orientation 的 ctx.translate/rotate/scale/drawImage 变换
- [x] 2.4 单元测试：验证 orientation 1/2/3/6/8 的变换矩阵正确性（mock ctx 方法调用顺序）

## 3. 选中/悬停视觉效果

- [x] 3.1 实现选中叠加层绘制：`#2563A8` alpha=0.08 矩形 + 1px alpha=0.15 内侧描边
- [x] 3.2 实现选中边框绘制：外发光（扩展 6px, width=3, alpha=0.2）+ 实色边框（扩展 1.5px, width=3）
- [x] 3.3 实现 CheckMark 绘制：白色外环(r=15) + 品牌色圆形(r=13) + 白色对勾路径(width=2.5)
- [x] 3.4 实现选中动画状态机：`setSelected()` 记录动画开始时间和方向，`draw()` 中根据 `now` 计算进度，返回 needsNextFrame
- [x] 3.5 实现悬停边框绘制：外发光（扩展 4px, width=3, alpha=0.2）+ 品牌色边框（扩展 1px, width=2）
- [x] 3.6 实现 `setHovered(hovered)` 方法
- [x] 3.7 实现 `updateZoomVisibility(zoomLevel)` 方法：计算信息覆盖层 alpha

## 4. 信息覆盖层绘制

- [x] 4.1 迁移辅助函数：`buildParamBadges()`, `truncateFileName()`, `maxCharsForWidth()` 到新文件（移除 PixiJS 依赖）
- [x] 4.2 实现渐变背景绘制：`ctx.createLinearGradient()` 从透明到 rgba(0,0,0,0.6)
- [x] 4.3 实现文件名绘制：`ctx.fillText()` + 缩放补偿 `ctx.scale(1/zoom, 1/zoom)`
- [x] 4.4 实现参数 Badge 绘制：`ctx.measureText()` 测量 + `ctx.roundRect()` 背景 + `ctx.fillText()` 文字
- [x] 4.5 实现合焦评分 Badge：星级文字 + 按评分着色背景
- [x] 4.6 实现未检测到主体 Badge：灰色背景 + 文字

## 5. 清理与集成

- [x] 5.1 删除 `src/components/canvas/ImageInfoOverlay.ts`
- [x] 5.2 更新所有导入 `CanvasImageItem` 的文件，适配新接口（`setTexture` → `setImage`，移除 `addChild/removeChild`）
- [x] 5.3 确认 `CanvasImageItem.ts` 无 `pixi.js` 导入残留
- [x] 5.4 运行 TypeScript 编译检查（`npx tsc --noEmit`），修复类型错误
- [x] 5.5 运行现有前端测试（`npx vitest run`），修复受影响的测试
