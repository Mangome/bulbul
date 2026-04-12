## Context

Bulbul 桌面应用使用 Canvas 2D 渲染 RAW 图片分组。当前画布支持 0.1x~5.0x 缩放（Ctrl+滚轮、滑块、快捷键），缩放逻辑贯穿 store、画布渲染、坐标转换、图片质量选择、UI 控件和持久化。

新布局采用固定列数（单图1列、多图2列）+ 自适应视口宽度，缩放功能已无用武之地。zoom 代码遍布约 10 个源文件，是最大的技术债之一。

## Goals / Non-Goals

**Goals:**

- 移除所有 zoom 相关状态、actions、UI、快捷键、持久化
- 简化画布渲染管线：ctx.scale(zoom, zoom) → 直接 1:1 渲染
- 简化坐标转换：去掉所有 `/zoom` `*zoom` 运算
- 移除图片质量阈值切换（`handleZoomThresholdChange`），固定使用 `item.width` 决定质量
- 清理相关测试

**Non-Goals:**

- 不修改布局算法（layout.ts）
- 不修改 ImageLoader / ImageLRUCache 核心逻辑
- 不修改 DotBackground（无 zoom 依赖）
- 不修改 GroupTitle（无 zoom 依赖）
- 不引入新功能

## Decisions

### 1. Loupe zoom 参数处理

**决定**: 从 Loupe props 中移除 `zoom` 参数，内部直接使用 `zoom=1` 计算。

**理由**: zoom 固定为 1 后，保留 prop 只是传递无意义的常量。直接在 Loupe 内移除 zoom 相关运算更干净。坐标映射公式从 `contentX = mouseX / zoom` 简化为 `contentX = mouseX`。

### 2. CanvasImageItem.draw() 签名

**决定**: 保留 `draw(ctx, zoom, now)` 签名不变，InfiniteCanvas 传入 `1`。

**理由**: draw 方法内检测框可见性判断 `zoom >= 0.4` 在 zoom=1 时始终为 true，可以移除条件。但修改 draw 签名会影响所有调用方和测试，改动面过大。保持签名稳定，仅清理内部无效分支。

### 3. fitToWindow 移除策略

**决定**: 同时移除 `fitToWindow` action 和 `fitCounter` 状态。

**理由**: fitToWindow 本质是计算最佳缩放比例并应用。无缩放后此功能无意义。InfiniteCanvas 中的 fitToWindow useEffect 也一并移除。

### 4. 设置文件向后兼容

**决定**: loadSettings() 加载时忽略旧文件中的 `zoomLevel` 字段（已有的 `typeof` 检查自然跳过不存在的字段），不做迁移。

**理由**: 老用户的 settings.json 中会残留 `zoomLevel` 字段，但 TypeScript 类型中不再包含它，JSON.parse 后该字段自然被忽略。无需写迁移逻辑。

## Risks / Trade-offs

- **[用户习惯]** 用户可能已习惯 Ctrl+滚轮缩放 → 移除后 Ctrl+滚轮将变为无操作。风险低：新布局本身已改变了交互模型。
- **[设置文件]** 旧 settings.json 中残留 `zoomLevel` 字段 → 无害，加载时自然忽略，下次保存时被覆盖。
- **[测试覆盖]** 移除 zoom 测试后测试数量减少 → 可接受，对应功能已不存在。
