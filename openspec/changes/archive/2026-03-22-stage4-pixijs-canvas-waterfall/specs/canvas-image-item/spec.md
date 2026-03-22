## ADDED Requirements

### Requirement: 图片 Sprite 渲染
每个可见图片项 SHALL 渲染为 PixiJS Sprite，按布局坐标定位，尺寸与 LayoutItem 一致。

#### Scenario: 正常渲染
- **WHEN** 图片纹理加载完成
- **THEN** 系统 SHALL 创建 Sprite 并设置 position、width、height 与 LayoutItem 一致

#### Scenario: 加载中占位
- **WHEN** 图片纹理尚未加载完成
- **THEN** 系统 SHALL 显示灰色占位色块（`#E5E7EB`），尺寸与 LayoutItem 一致

### Requirement: 底部信息覆盖层
每个图片项 SHALL 在底部显示半透明渐变信息覆盖层，包含文件名和拍摄参数。

#### Scenario: 渐变背景
- **WHEN** 图片项渲染
- **THEN** 底部 15% 高度 SHALL 渲染线性渐变背景（transparent → rgba(0,0,0,0.7)）

#### Scenario: 信息行 1
- **WHEN** 图片项渲染
- **THEN** 覆盖层第一行 SHALL 显示文件名 Badge

#### Scenario: 信息行 2
- **WHEN** 图片项渲染且元数据可用
- **THEN** 覆盖层第二行 SHALL 显示光圈、快门、ISO、焦段 Badge（半透明黑色背景，白色文字，pill 圆角）

#### Scenario: 低缩放隐藏
- **WHEN** 缩放级别 < 30%
- **THEN** 信息覆盖层 SHALL 隐藏（`visible = false`），减少渲染开销

### Requirement: 分组标题渲染
每个分组 SHALL 在其图片列表上方渲染分组标题文本。

#### Scenario: 标题内容
- **WHEN** 分组渲染
- **THEN** 标题 SHALL 显示分组名称（如"分组 1"）和图片数量（如"12 张"）
