## 1. Canvas 初始化与基础渲染

- [x] 1.1 创建 InfiniteCanvas.tsx，添加 `<canvas>` DOM 元素和 ref
- [x] 1.2 实现 setupCanvas(canvas, container) 初始化函数，处理 DPR 和坐标系
- [x] 1.3 添加 useEffect 初始化，创建 CanvasRenderingContext2D
- [x] 1.4 实现 markDirty() 和 renderFrame() 的 dirty flag 机制
- [x] 1.5 实现基础 renderFrame()，包括清空、背景色绘制、波点背景
- [x] 1.6 添加 ResizeObserver 监听容器大小变化，重新初始化 Canvas
- [x] 1.7 添加 matchMedia 监听 DPR 变化（多显示器场景）
- [x] 1.8 实现 cleanup 逻辑，取消 rAF、移除监听器

## 2. 事件处理系统

- [x] 2.1 绑定 wheel 事件，实现 handleWheel() 滚轮缩放逻辑
- [x] 2.2 实现缩放锚点计算（鼠标位置保持相对位置）
- [x] 2.3 绑定 pointerdown/pointermove/pointerup，实现拖拽平移
- [x] 2.4 实现拖拽死区检测（5px），区分点击和拖拽
- [x] 2.5 实现 handleCanvasClick()，进行坐标变换和 hitTest
- [x] 2.6 实现 pointermove 悬停检测（非拖拽状态）
- [x] 2.7 集成全局键盘事件（W/S/Q/Ctrl+A 快捷键）
- [x] 2.8 添加所有事件处理的 markDirty() 调用

## 3. CanvasImageItem 池与虚拟化

- [x] 3.1 创建 canvasItemsRef Map 管理 CanvasImageItem 实例池
- [x] 3.2 创建 ImageLoader 实例，初始化 image 缓存
- [x] 3.3 实现 updateViewport() 函数，计算可见区域
- [x] 3.4 实现 getVisibleItems() 和 diffVisibleItems() 调用
- [x] 3.5 实现 enter 分支：创建 CanvasImageItem，异步加载图片
- [x] 3.6 实现 leave 分支：销毁 CanvasImageItem，evict 缓存
- [x] 3.7 集成 canvasItem 生命周期中的 setImageInfo() 调用

## 4. CanvasImageItem 绘制集成

- [x] 4.1 在 renderFrame() 中添加坐标变换（ctx.save/translate/scale）
- [x] 4.2 遍历 canvasItemsRef，调用 item.draw(ctx, actualZoom, now)
- [x] 4.3 根据 draw() 返回值判断是否需要下一帧（动画检测）
- [x] 4.4 绘制 DotBackground（固定视口前）
- [x] 4.5 绘制分组标题（在坐标变换后）
- [x] 4.6 实现 ctx.restore() 恢复坐标系
- [x] 4.7 测试基本渲染：图片、占位色块、选中框、悬停框

## 5. 选中交互与视觉同步

- [x] 5.1 实现 syncSelectionVisuals() 函数，遍历所有 item 调用 setSelected()
- [x] 5.2 集成 useSelectionStore 订阅，状态变化时调用 syncSelectionVisuals() + markDirty()
- [x] 5.3 在 handleCanvasClick() 中调用 toggleSelection() 和 syncSelectionVisuals()
- [x] 5.4 实现鼠标悬停时的 setHovered() 调用
- [x] 5.5 验证选中/悬停动画正常渲染

## 6. 分组切换动画

- [x] 6.1 创建 startGroupTransitionAnimation(newGroupIndex) 函数
- [x] 6.2 实现离屏 Canvas 创建（OffscreenCanvas 或 canvas 元素）
- [x] 6.3 绘制旧分组 item 到 offscreenA
- [x] 6.4 绘制新分组 item 到 offscreenB（包含 fallback 占位色块）
- [x] 6.5 实现 easeOutQuart 缓动函数计算
- [x] 6.6 实现动画循环：淡入淡出、可选位移
- [x] 6.7 动画中调用 updateViewport() 预加载新分组
- [x] 6.8 动画结束清理、释放 OffscreenCanvas
- [x] 6.9 集成 prefers-reduced-motion 检测，跳过动画

## 7. Zustand 状态同步

- [x] 7.1 添加 useCanvasStore 订阅，处理 zoomLevel、scrollY 变化
- [x] 7.2 添加 useSelectionStore 订阅，处理选中状态变化
- [x] 7.3 添加 useThemeStore 订阅，处理主题切换
- [x] 7.4 在这些订阅中调用相应的 markDirty()、DotBackground.updateTheme() 等

## 8. useImperativeHandle 接口

- [x] 8.1 实现 useImperativeHandle(ref, () => ({...}))
- [x] 8.2 实现 syncSelectionVisuals() 方法
- [x] 8.3 实现 scrollToY(y) 方法
- [x] 8.4 实现 updateItemMetadata(hash) 方法

## 9. 清理与优化

- [x] 9.1 从 package.json 中移除 pixi.js 依赖
- [x] 9.2 运行 npm uninstall pixi.js
- [x] 9.3 删除 src/components/canvas/ImageInfoOverlay.ts（逻辑已内联）
- [x] 9.4 全局搜索确认无 pixi.js import 残留
- [x] 9.5 检查是否有 PixiJS 相关类型定义文件需要删除
- [x] 9.6 更新 InfiniteCanvas 的 JSDoc，说明 Canvas 2D 新架构

## 10. 测试

- [x] 10.1 更新/创建 InfiniteCanvas.test.tsx，mock Canvas context
- [x] 10.2 测试 DPR 初始化和 resize 处理
- [x] 10.3 测试滚轮缩放逻辑（锚点、clamp）
- [x] 10.4 测试拖拽平移和死区检测
- [x] 10.5 测试点击选中和 hitTest
- [x] 10.6 测试悬停高亮
- [x] 10.7 测试虚拟化（enter/leave）
- [x] 10.8 测试分组切换动画（包括快速切组）
- [x] 10.9 运行 npx vitest run 确保所有单元测试通过
- [ ] 10.10 运行 npm run tauri dev 手动测试完整流程

## 11. 集成测试与验证

- [ ] 11.1 验证基本渲染：打开文件夹后图片正常显示
- [ ] 11.2 验证占位色块 → 图片过渡
- [ ] 11.3 验证滚轮缩放 0.1x ~ 3.0x，锚点正确
- [ ] 11.4 验证拖拽平移流畅，不越界
- [ ] 11.5 验证分组切换动画流畅无闪烁
- [ ] 11.6 **关键验证**：连续快速切组不崩溃
- [ ] 11.7 验证选中/取消选中，边框 + ✓ 标记显示
- [ ] 11.8 验证鼠标悬停高亮，移出恢复
- [ ] 11.9 验证信息覆盖层在缩放 >= 0.4 时显示
- [ ] 11.10 验证暗/亮主题切换，背景和波点色正确
- [ ] 11.11 验证键盘快捷键（W/S/Q/Ctrl+A）
- [ ] 11.12 验证长时间浏览无内存泄漏
