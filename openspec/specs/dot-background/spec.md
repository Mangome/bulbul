## MODIFIED Requirements

### Requirement: 波点底纹渲染
系统 SHALL 在画布最底层渲染波点底纹背景，底纹 SHALL 覆盖整个可见视口区域。

#### Scenario: 波点纹理生成
- **WHEN** 画布初始化
- **THEN** 系统使用 OffscreenCanvas 生成波点 CanvasPattern，波点间距 40px、半径 1.0px、亮色主题颜色 #E0E4EB、暗色主题颜色 #232D40、透明度 0.5

#### Scenario: 底纹不受缩放影响
- **WHEN** 用户缩放画布
- **THEN** 波点底纹 SHALL 保持固定大小和间距，不随 ContentLayer 缩放变化

#### Scenario: 底纹铺满视口
- **WHEN** 窗口 resize 或画布重绘
- **THEN** 波点底纹 SHALL 使用 CanvasPattern + fillRect 铺满整个可见区域，无缝重复
