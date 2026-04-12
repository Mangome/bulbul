## MODIFIED Requirements

### Requirement: 悬浮放大镜组件
系统 SHALL 提供 Magnifier React 组件，以 HTML overlay 形式在画布容器内显示，当鼠标悬停在缩略图上时弹出大图预览窗口。坐标映射不再涉及缩放变换。

#### Scenario: 鼠标悬停触发放大镜
- **WHEN** 鼠标在画布上移动且 hitTest 命中一个可见的缩略图
- **THEN** 放大镜 SHALL 显示该缩略图对应的大图预览
- **AND** 放大镜位置在鼠标右上方偏移

#### Scenario: 坐标映射
- **WHEN** 放大镜需要将鼠标屏幕坐标映射到缩略图内容坐标
- **THEN** 使用 contentX = mouseX, contentY = mouseY - offsetY（offsetY = -scrollY + paddingTop）
- **AND** 不再使用 zoom 除法
