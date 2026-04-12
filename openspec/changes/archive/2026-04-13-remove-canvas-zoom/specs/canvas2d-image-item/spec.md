## MODIFIED Requirements

### Requirement: Canvas 2D 图片绘制
系统 SHALL 通过 `CanvasImageItem.draw(ctx, zoom, now)` 方法将图片项绘制到指定的 `CanvasRenderingContext2D` 上。当 `alpha <= 0` 时 SHALL 跳过绘制。检测框覆盖层在 `detectionVisible` 为 true 且有检测数据时 SHALL 始终绘制（不再有缩放阈值条件）。

绘制顺序 SHALL 为：
1. 占位色块或图片（应用 EXIF Orientation）
2. 检测框覆盖层（当 `detectionVisible` 为 true 且有检测数据时）
3. 选中视觉效果

#### Scenario: 检测框始终绘制
- **WHEN** `draw()` 被调用且 `detectionVisible` 为 true 且 `detectionBoxes` 非空
- **THEN** 系统 SHALL 绘制检测框覆盖层，不受 zoom 值限制

## REMOVED Requirements

### Requirement: 信息覆盖层绘制（内联）
**Reason**: 缩略图模式下信息覆盖层已由 Magnifier 组件替代，且缩放可见性控制逻辑不再适用
**Migration**: 信息展示由 Magnifier 组件负责
