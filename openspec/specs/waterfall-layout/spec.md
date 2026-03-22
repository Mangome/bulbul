## ADDED Requirements

### Requirement: 3 列瀑布流布局计算
系统 SHALL 将分组图片按 3 列瀑布流进行布局计算，每张图片根据其原始宽高比确定渲染高度。

#### Scenario: 标准布局计算
- **WHEN** 给定一组 GroupData[] 和每张图片的尺寸信息
- **THEN** 系统输出 LayoutItem[] 数组，每个元素包含 hash、groupId、x、y、width、height

#### Scenario: 最短列分配
- **WHEN** 需要放置下一张图片
- **THEN** 系统 SHALL 将图片分配到当前高度最短的列

#### Scenario: 图片高度按比例计算
- **WHEN** 图片原始宽高比为 W:H，列宽为 columnWidth
- **THEN** 渲染高度 SHALL 为 `(columnWidth / W) * H`

#### Scenario: 缺失尺寸信息回退
- **WHEN** 图片缺少 image_width 或 image_height 信息
- **THEN** 系统 SHALL 回退到 3:2 的默认宽高比

### Requirement: 分组标题区域
每个分组 SHALL 在其图片列表上方预留分组标题区域。

#### Scenario: 分组标题高度
- **WHEN** 开始计算某个分组的图片布局
- **THEN** 系统 SHALL 在该分组起始位置预留 40px 高度的标题区域

#### Scenario: 分组间距
- **WHEN** 上一个分组的图片布局结束
- **THEN** 下一个分组 SHALL 在最高列底部 + 60px 间距后开始

### Requirement: 布局配置参数
布局引擎 SHALL 使用以下固定配置参数：列数 3、水平间距 20px、垂直间距 20px、边距 30px、最小列宽 200px、分组间距 60px、分组标题高度 40px。

#### Scenario: 列宽计算
- **WHEN** 视口宽度为 viewportWidth
- **THEN** 列宽 SHALL 为 `max(200, (viewportWidth - 30*2 - 20*2) / 3)` px

### Requirement: 空分组处理
系统 SHALL 正确处理空分组（图片数为 0）。

#### Scenario: 空分组跳过
- **WHEN** 某个 GroupData 的 pictureHashes 为空数组
- **THEN** 该分组 SHALL 仅渲染标题区域，不分配图片布局空间
