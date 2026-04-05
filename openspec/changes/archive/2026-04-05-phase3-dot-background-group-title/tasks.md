## 1. DotBackground 重写

- [x] 1.1 重写 `src/components/canvas/DotBackground.ts`：移除所有 PixiJS 导入（Container、Graphics、TilingSprite），改为独立类，不继承任何基类
- [x] 1.2 实现 `updateTheme(theme, ctx)` 方法：使用 OffscreenCanvas(40×40) 绘制单个波点（半径 1.0px，居中），通过 `ctx.createPattern(offscreen, 'repeat')` 生成 CanvasPattern，缓存 currentTheme 避免重复生成
- [x] 1.3 实现 `draw(ctx, width, height)` 方法：设置 `ctx.fillStyle = pattern` 后调用 `ctx.fillRect(0, 0, width, height)` 铺满视口，pattern 为 null 时跳过
- [x] 1.4 实现 `destroy()` 方法：将 pattern 引用置为 null
- [x] 1.5 验证亮色主题波点颜色 #E0E4EB alpha=0.5 和暗色主题波点颜色 #232D40 alpha=0.5 参数正确

## 2. GroupTitle 重写

- [x] 2.1 重写 `src/components/canvas/GroupTitle.ts`：移除所有 PixiJS 导入（Container、Text），改为导出纯函数 `drawGroupTitles(ctx, titles, zoom)`
- [x] 2.2 实现标题绘制逻辑：字体 `700 16px system-ui, -apple-system, sans-serif`，颜色 #374151，垂直居中定位
- [x] 2.3 保留 `truncateGroupLabel()` 截断函数：字符估算 ~10px/字符，超出加 "..."

## 3. 编译验证

- [x] 3.1 运行 `npx tsc --noEmit` 确认无 TypeScript 编译错误
- [x] 3.2 确认两个文件无 `pixi.js` 导入残留
