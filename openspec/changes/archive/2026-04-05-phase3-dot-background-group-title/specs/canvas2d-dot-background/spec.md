## ADDED Requirements

### Requirement: Canvas 2D 波点 Pattern 生成
系统 SHALL 使用 OffscreenCanvas 生成 40×40 像素的波点 tile，通过 `CanvasRenderingContext2D.createPattern()` 创建可重复填充的 CanvasPattern。

#### Scenario: 亮色主题 Pattern 生成
- **WHEN** 系统初始化或切换到亮色主题
- **THEN** 系统 SHALL 生成波点 Pattern，波点颜色为 #E0E4EB，透明度 0.5，半径 1.0px，间距 40px

#### Scenario: 暗色主题 Pattern 生成
- **WHEN** 系统切换到暗色主题
- **THEN** 系统 SHALL 生成波点 Pattern，波点颜色为 #232D40，透明度 0.5，半径 1.0px，间距 40px

### Requirement: Canvas 2D 波点背景绘制
系统 SHALL 通过 `draw(ctx, width, height)` 方法使用 CanvasPattern 一次性填充整个视口区域。

#### Scenario: 绘制波点背景
- **WHEN** InfiniteCanvas 渲染循环调用 `draw(ctx, width, height)`
- **THEN** 系统 SHALL 使用已缓存的 CanvasPattern 调用 `ctx.fillRect(0, 0, width, height)` 铺满视口

#### Scenario: Pattern 未初始化时跳过绘制
- **WHEN** `draw()` 被调用但 Pattern 尚未创建
- **THEN** 系统 SHALL 跳过绘制，不抛出异常

### Requirement: 波点背景不受画布缩放影响
波点背景 SHALL 固定在屏幕坐标系，不随 ContentLayer 的缩放/平移变换而改变。

#### Scenario: 缩放时波点保持固定
- **WHEN** 用户缩放画布
- **THEN** 波点间距和大小 SHALL 保持不变

### Requirement: 主题切换更新 Pattern
系统 SHALL 在主题切换时重新生成 CanvasPattern。

#### Scenario: 主题从亮色切换到暗色
- **WHEN** 调用 `updateTheme('dark', ctx)`
- **THEN** 系统 SHALL 重新生成暗色波点 Pattern 并在下次绘制时使用

#### Scenario: 相同主题不重复生成
- **WHEN** 调用 `updateTheme()` 但主题未变化
- **THEN** 系统 SHALL 跳过 Pattern 重建

### Requirement: 资源清理
系统 SHALL 提供 `destroy()` 方法清理 Pattern 引用。

#### Scenario: 销毁时释放资源
- **WHEN** 调用 `destroy()`
- **THEN** 系统 SHALL 将 Pattern 引用置为 null
