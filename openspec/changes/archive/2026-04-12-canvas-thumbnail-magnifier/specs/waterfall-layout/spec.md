## REMOVED Requirements

### Requirement: 3 列瀑布流布局计算
**Reason**: 替换为纵向行式缩略图网格布局，由 thumbnail-grid-layout spec 定义
**Migration**: 使用新的 computeVerticalGridLayout() 替代 computeHorizontalLayout()，布局逻辑完全重写

### Requirement: 分组标题区域（3 列瀑布流版本）
**Reason**: 分组标题高度和间距由新的 thumbnail-grid-layout spec 定义
**Migration**: 新布局中 groupTitleHeight=40px, groupGap=40px

### Requirement: 布局配置参数（3 列瀑布流版本）
**Reason**: 配置参数由新的 thumbnail-grid-layout spec 定义
**Migration**: 新参数 thumbnailSize=160px, gap=8px, paddingX=24px 等

### Requirement: 空分组处理（3 列瀑布流版本）
**Reason**: 空分组处理逻辑由新的 thumbnail-grid-layout spec 定义
**Migration**: 行为相同，空分组仅渲染标题区域
