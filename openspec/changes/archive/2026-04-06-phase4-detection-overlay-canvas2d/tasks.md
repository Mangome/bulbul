## 1. 创建检测框绘制函数模块

- [x] 1.1 创建 `src/components/canvas/drawDetectionOverlay.ts`，导出 `drawDetectionOverlay(ctx, boxes, displayWidth, displayHeight)` 函数
- [x] 1.2 实现归一化坐标 → 像素坐标转换，包含最小框尺寸过滤（< 10px 不绘制）
- [x] 1.3 实现主框/副框颜色区分（绿色 #22C55E / 黄色 #EAB308），按最高置信度判断主框
- [x] 1.4 实现折角矩形边框绘制（ctx.beginPath + moveTo/lineTo，折角 12px，线宽 2px）
- [x] 1.5 实现置信度标签绘制（"Bird: XX%" 文字 + 黑色 alpha=0.7 圆角背景，12px system-ui 白色字体）

## 2. 集成到 CanvasImageItem

- [x] 2.1 为 `CanvasImageItem` 添加 `detectionBoxes: DetectionBox[]` 和 `detectionVisible: boolean` 私有属性
- [x] 2.2 实现 `setDetectionBoxes(boxes: DetectionBox[])` 公共方法
- [x] 2.3 实现 `setDetectionVisible(visible: boolean)` 公共方法
- [x] 2.4 在 `draw()` 方法中插入检测框绘制调用（图片之后、信息覆盖层之前）
- [x] 2.5 在 `destroy()` 方法中清理检测框数据

## 3. 删除旧实现

- [x] 3.1 删除 `src/components/DetectionOverlay.tsx`
- [x] 3.2 确认无其他文件引用 `DetectionOverlay` 组件（全局搜索 import）

## 4. 测试

- [x] 4.1 为 `drawDetectionOverlay` 编写单元测试：空数组、单框、多框（主副框颜色）、最小尺寸过滤
- [x] 4.2 为 `CanvasImageItem` 补充检测框相关测试：setDetectionBoxes、setDetectionVisible、destroy 清理
- [x] 4.3 运行 `npx tsc --noEmit` 确认无类型错误
- [x] 4.4 运行 `npx vitest run` 确认所有测试通过
