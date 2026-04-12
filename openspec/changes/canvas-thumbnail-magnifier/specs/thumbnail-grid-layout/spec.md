## ADDED Requirements

### Requirement: 纵向行式缩略图网格布局
系统 SHALL 将所有分组纵向排列，组内缩略图按行式网格排布，每行缩略图等宽、行高等于该行最高图的缩放高度。

#### Scenario: 标准网格布局计算
- **WHEN** 给定 GroupData[]、图片尺寸信息、视口宽度
- **THEN** 系统输出 LayoutItem[] 数组，每个元素包含 hash、groupId、groupIndex、x、y、width、height
- **AND** 所有分组纵向排列，y 坐标连续递增

#### Scenario: 列数自适应视口宽度
- **WHEN** 视口宽度为 viewportWidth，缩略图基础尺寸为 thumbnailSize，间距为 gap，水平边距为 paddingX
- **THEN** 列数 SHALL 为 `floor((viewportWidth - paddingX * 2 + gap) / (thumbnailSize + gap))`
- **AND** 列数最小为 1

#### Scenario: 缩略图等宽缩放
- **WHEN** 列宽为 columnWidth，图片原始宽高比为 W:H
- **THEN** 渲染宽度 SHALL 为 columnWidth
- **AND** 渲染高度 SHALL 为 `(columnWidth / W) * H`

#### Scenario: 行高等于该行最高图
- **WHEN** 一行中包含多张不同宽高比的图片
- **THEN** 行高 SHALL 等于该行中最高图片的渲染高度
- **AND** 同行其他图片垂直居中对齐

#### Scenario: 缺失尺寸信息回退
- **WHEN** 图片缺少 width 或 height 信息
- **THEN** 系统 SHALL 回退到 3:2 的默认宽高比

#### Scenario: 最后一行居左排列
- **WHEN** 分组最后一行图片数量不足列数
- **THEN** 图片 SHALL 从左侧开始排列，不留空位

### Requirement: 分组标题区域
每个分组 SHALL 在其缩略图网格上方显示分组标题区域。

#### Scenario: 分组标题高度
- **WHEN** 开始计算某个分组的缩略图布局
- **THEN** 系统 SHALL 在该分组起始位置预留 groupTitleHeight（40px）高度的标题区域

#### Scenario: 分组间距
- **WHEN** 上一个分组的布局结束
- **THEN** 下一个分组 SHALL 在上一个分组底部 + groupGap（40px）间距后开始

#### Scenario: 分组标题内容
- **WHEN** 分组标题绘制
- **THEN** 标题文本 SHALL 为 `{组名}（{N}张）`

### Requirement: 布局配置参数
布局引擎 SHALL 使用以下配置参数。

#### Scenario: 默认参数值
- **WHEN** 未指定自定义配置
- **THEN** 系统 SHALL 使用：thumbnailSize=160px, gap=8px, paddingX=24px, paddingY=16px, groupGap=40px, groupTitleHeight=40px, paddingTop=80px（为浮动栏预留）, paddingBottom=88px（为浮动栏预留）

#### Scenario: 列宽计算
- **WHEN** 视口宽度为 viewportWidth
- **THEN** 列宽 SHALL 为 `(viewportWidth - paddingX * 2 - gap * (columns - 1)) / columns`

### Requirement: 空分组处理
系统 SHALL 正确处理空分组（图片数为 0）。

#### Scenario: 空分组仅渲染标题
- **WHEN** 某个 GroupData 的 pictureHashes 为空数组
- **THEN** 该分组 SHALL 仅渲染标题区域，不分配缩略图布局空间

### Requirement: 布局结果接口
LayoutResult SHALL 提供纵向流布局信息。

#### Scenario: LayoutResult 包含分组页面信息
- **WHEN** 布局计算完成
- **THEN** LayoutResult SHALL 包含 pages[] 数组，每个 GroupPageLayout 含 offsetY（纵向偏移）、contentHeight、items、sortedItems（按 Y 排序）
- **AND** totalHeight 为所有分组内容高度的最大值
- **AND** 所有分组的 columnWidth 一致（无需缩放补偿）

#### Scenario: 内容水平居中
- **WHEN** 缩略图网格总宽度小于视口宽度
- **THEN** 内容 SHALL 水平居中，两侧留白相等
