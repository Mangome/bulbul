## ADDED Requirements

### Requirement: 波点底纹渲染
系统 SHALL 在画布最底层渲染波点底纹背景，底纹 SHALL 覆盖整个可见视口区域。

#### Scenario: 波点纹理生成
- **WHEN** 画布初始化
- **THEN** 系统生成波点纹理贴图，主波点间距 20px、半径 3px、颜色 rgba(225,225,225,0.47)，小波点半径 2px、颜色 rgba(200,200,200,0.31)

#### Scenario: 底纹不受缩放影响
- **WHEN** 用户缩放画布
- **THEN** 波点底纹 SHALL 保持固定大小和间距，不随 ContentLayer 缩放变化

#### Scenario: 底纹铺满视口
- **WHEN** 窗口 resize 或画布平移
- **THEN** 波点底纹 SHALL 使用 TilingSprite 铺满整个可见区域，无缝重复
