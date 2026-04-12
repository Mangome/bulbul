// ============================================================
// 纵向行式缩略图网格布局引擎
//
// 所有分组纵向排列，组内缩略图按行式网格排布，
// 每行缩略图等宽、行高等于该行最高图的缩放高度。
//
// 接收分组数据 + 图片尺寸信息 + 视口尺寸，
// 一次性预计算所有图片的绝对坐标，供画布渲染和视口裁剪使用。
// ============================================================

import type { GroupData } from '../types';

// ─── 配置 ─────────────────────────────────────────────

/** 布局固定配置参数 */
export interface LayoutConfig {
  /** 缩略图基础尺寸 (px) */
  readonly thumbnailSize: number;
  /** 缩略图间距 (px) */
  readonly gap: number;
  /** 水平边距 (px) */
  readonly paddingX: number;
  /** 垂直边距 (px) */
  readonly paddingY: number;
  /** 分组之间的间距 (px) */
  readonly groupGap: number;
  /** 分组标题高度 (px) */
  readonly groupTitleHeight: number;
  /** 页面顶部内边距 (px) */
  readonly paddingTop: number;
  /** 页面底部内边距 (px) */
  readonly paddingBottom: number;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  thumbnailSize: 450,
  gap: 12,
  paddingX: 32,
  paddingY: 20,
  groupGap: 48,
  groupTitleHeight: 48,
  paddingTop: 80,     // 为顶部浮动栏预留空间
  paddingBottom: 88,   // 为底部浮动栏预留空间
};

// ─── 类型定义 ─────────────────────────────────────────

/** 图片尺寸信息 */
export interface ImageDimension {
  width: number;
  height: number;
}

/** 布局计算结果中的单个元素 */
export interface LayoutItem {
  /** 图片 hash */
  hash: string;
  /** 所属分组 ID */
  groupId: number;
  /** 所属分组索引 (0-based) */
  groupIndex: number;
  /** 绝对 X 坐标 */
  x: number;
  /** 绝对 Y 坐标 */
  y: number;
  /** 渲染宽度 */
  width: number;
  /** 渲染高度 */
  height: number;
}

/** 分组标题布局信息 */
export interface GroupTitleItem {
  groupId: number;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 单个分组页面的布局 */
export interface GroupPageLayout {
  /** 分组在 groups 数组中的索引 */
  groupIndex: number;
  /** 分组 ID */
  groupId: number;
  /** 该分组的纵向偏移 */
  offsetY: number;
  /** 该分组内容的总高度（含标题、paddingY、内容行） */
  contentHeight: number;
  /** 统一列宽 (px) */
  columnWidth: number;
  /** 该分组包含的所有 LayoutItem */
  items: LayoutItem[];
  /** 分组标题 */
  groupTitle: GroupTitleItem;
  /** 按 Y 坐标排序的 LayoutItem 引用 (用于虚拟化) */
  sortedItems: LayoutItem[];
}

/** 完整的纵向布局计算结果 */
export interface LayoutResult {
  /** 所有 LayoutItem（用于全局查询） */
  items: LayoutItem[];
  /** 所有分组标题 */
  groupTitles: GroupTitleItem[];
  /** 分组页面布局数组 */
  pages: GroupPageLayout[];
  /** 列宽（所有分组统一） */
  columnWidth: number;
  /** 总高度 (所有分组纵向累加) */
  totalHeight: number;
}

// ─── 默认宽高比 ──────────────────────────────────────

/** 缺失尺寸时的默认宽高比 (3:2) */
const DEFAULT_ASPECT_RATIO = 3 / 2;

// ─── 核心算法 ─────────────────────────────────────────

/**
 * 计算列宽
 */
export function computeColumnWidth(
  viewportWidth: number,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): number {
  const columns = computeColumnCount(viewportWidth, config);
  return (viewportWidth - config.paddingX * 2 - config.gap * (columns - 1)) / columns;
}

/**
 * 计算列数
 */
function computeColumnCount(
  viewportWidth: number,
  config: LayoutConfig,
): number {
  return Math.max(1, Math.floor(
    (viewportWidth - config.paddingX * 2 + config.gap) / (config.thumbnailSize + config.gap),
  ));
}

/**
 * 一次性全量计算纵向行式缩略图网格布局
 *
 * 所有分组纵向排列，组内缩略图按行排布。
 * 算法复杂度: O(n)
 */
export function computeVerticalGridLayout(
  groups: GroupData[],
  imageDimensions: Map<string, ImageDimension>,
  viewportWidth: number,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): LayoutResult {
  const columns = computeColumnCount(viewportWidth, config);
  const columnWidth = (viewportWidth - config.paddingX * 2 - config.gap * (columns - 1)) / columns;

  const allItems: LayoutItem[] = [];
  const groupTitles: GroupTitleItem[] = [];
  const pages: GroupPageLayout[] = [];

  let currentY = config.paddingTop;

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const pageStartY = currentY;

    // 内容块宽度，水平居中
    const contentBlockWidth = columns * columnWidth + (columns - 1) * config.gap;
    const contentOffsetX = config.paddingX + (viewportWidth - config.paddingX * 2 - contentBlockWidth) / 2;

    // 分组标题
    const titleItem: GroupTitleItem = {
      groupId: group.id,
      label: `${group.name}（${group.imageCount} 张）`,
      x: contentOffsetX,
      y: currentY,
      width: contentBlockWidth,
      height: config.groupTitleHeight,
    };
    groupTitles.push(titleItem);

    currentY += config.groupTitleHeight + config.paddingY;

    const pageItems: LayoutItem[] = [];

    // 空分组：仅渲染标题区域
    if (group.pictureHashes.length === 0) {
      const contentHeight = currentY - pageStartY;
      pages.push({
        groupIndex: gi,
        groupId: group.id,
        offsetY: pageStartY,
        contentHeight,
        columnWidth,
        items: [],
        groupTitle: titleItem,
        sortedItems: [],
      });
      // 空分组不需要 groupGap
      continue;
    }

    // 按行排布缩略图
    let colIdx = 0;
    let rowStartY = currentY;
    let rowMaxHeight = 0;

    for (const hash of group.pictureHashes) {
      const dim = imageDimensions.get(hash);
      const aspectRatio = dim ? dim.width / dim.height : DEFAULT_ASPECT_RATIO;

      const renderWidth = columnWidth;
      const renderHeight = columnWidth / aspectRatio;

      const x = contentOffsetX + colIdx * (columnWidth + config.gap);
      const item: LayoutItem = {
        hash,
        groupId: group.id,
        groupIndex: gi,
        x,
        y: rowStartY, // 临时值，后面会调整
        width: renderWidth,
        height: renderHeight,
      };

      rowMaxHeight = Math.max(rowMaxHeight, renderHeight);
      pageItems.push(item);

      colIdx++;

      if (colIdx >= columns) {
        // 行结束，调整同行所有 item 的 Y 坐标（垂直居中）
        for (let i = pageItems.length - columns; i < pageItems.length; i++) {
          const rowItem = pageItems[i];
          const yOffset = (rowMaxHeight - rowItem.height) / 2;
          rowItem.y = rowStartY + yOffset;
        }

        rowStartY += rowMaxHeight + config.gap;
        rowMaxHeight = 0;
        colIdx = 0;
      }
    }

    // 处理最后一行（不足 columns 张）
    if (colIdx > 0) {
      // 最后一行居左排列，调整垂直居中
      for (let i = pageItems.length - colIdx; i < pageItems.length; i++) {
        const rowItem = pageItems[i];
        const yOffset = (rowMaxHeight - rowItem.height) / 2;
        rowItem.y = rowStartY + yOffset;
      }
      rowStartY += rowMaxHeight;
    }

    const contentBottomY = rowStartY + config.paddingY;
    const contentHeight = contentBottomY - pageStartY;

    allItems.push(...pageItems);

    const sortedItems = [...pageItems].sort((a, b) => a.y - b.y);

    pages.push({
      groupIndex: gi,
      groupId: group.id,
      offsetY: pageStartY,
      contentHeight,
      columnWidth,
      items: pageItems,
      groupTitle: titleItem,
      sortedItems,
    });

    // 分组间间距
    currentY = contentBottomY + config.groupGap;
  }

  const totalHeight = currentY - config.groupGap + config.paddingBottom;

  return {
    items: allItems,
    groupTitles,
    pages,
    columnWidth,
    totalHeight: Math.max(0, totalHeight),
  };
}

// ─── 旧接口兼容 ─────────────────────────────────────

/** @deprecated 使用 computeVerticalGridLayout 代替 */
export const computeHorizontalLayout = computeVerticalGridLayout;

/** @deprecated 使用 computeVerticalGridLayout 代替 */
export function computeWaterfallLayout(
  groups: GroupData[],
  imageDimensions: Map<string, ImageDimension>,
  viewportWidth: number,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): LayoutResult {
  return computeVerticalGridLayout(groups, imageDimensions, viewportWidth, config);
}
