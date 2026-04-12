// ============================================================
// 视口裁剪引擎 (纵向滚动模式)
//
// 基于 Y 轴二分搜索定位可见元素。
// 支持增量 diff (enter/leave) 算法。
// ============================================================

import type { LayoutItem, GroupPageLayout } from '../utils/layout';

// ─── 类型 ─────────────────────────────────────────────

/** 视口矩形 (内容坐标系) */
export interface ViewportRect {
  /** X 起始（纵向模式下恒为 0） */
  x: number;
  /** Y 起始 (= scrollY) */
  y: number;
  width: number;
  height: number;
}

/** 增量 diff 结果 */
export interface ViewportDiff {
  /** 新进入视口的元素 */
  enter: LayoutItem[];
  /** 离开视口的元素 */
  leave: LayoutItem[];
}

// ─── 二分搜索 ─────────────────────────────────────────

/**
 * 二分搜索：在按 Y 排序的数组中找到第一个 y + height >= minY 的元素索引
 */
function lowerBound(items: LayoutItem[], minY: number): number {
  let lo = 0;
  let hi = items.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (items[mid].y + items[mid].height < minY) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

// ─── 综合可见元素查询 ─────────────────────────────────

/**
 * 获取视口中所有可见的元素
 *
 * 在所有分组页面的 sortedItems 上做 Y 轴二分查找，
 * 不再进行水平分组过滤。
 *
 * @param pages 所有分组页面
 * @param _pageWidth 保留参数（纵向模式下不使用）
 * @param viewport 视口矩形
 * @param bufferRatio 缓冲区比例（默认 1.0，视口高度的倍数）
 * @returns 所有可见的 LayoutItem 数组
 */
export function getVisibleItems(
  pages: GroupPageLayout[],
  _pageWidth: number,
  viewport: ViewportRect,
  bufferRatio: number = 1.0,
): LayoutItem[] {
  if (pages.length === 0) return [];

  const buffer = viewport.height * bufferRatio;
  const minY = viewport.y - buffer;
  const maxY = viewport.y + viewport.height + buffer;

  const result: LayoutItem[] = [];

  for (const page of pages) {
    // 跳过完全不在视口范围内的分组
    const pageTop = page.offsetY;
    const pageBottom = page.offsetY + page.contentHeight;
    if (pageBottom < minY || pageTop > maxY) continue;

    const startIdx = lowerBound(page.sortedItems, minY);

    for (let i = startIdx; i < page.sortedItems.length; i++) {
      const item = page.sortedItems[i];
      if (item.y > maxY) break;
      result.push(item);
    }
  }

  return result;
}

// ─── 增量 Diff ────────────────────────────────────────

/**
 * 计算两帧之间的视口可见元素变化
 *
 * 使用 Set 实现 O(n) diff。
 *
 * @param prevVisible 上一帧的可见元素
 * @param currVisible 当前帧的可见元素
 * @returns enter（新进入的）和 leave（离开的）列表
 */
export function diffVisibleItems(
  prevVisible: LayoutItem[],
  currVisible: LayoutItem[],
): ViewportDiff {
  const prevSet = new Set(prevVisible.map((item) => item.hash));
  const currSet = new Set(currVisible.map((item) => item.hash));

  const enter: LayoutItem[] = [];
  const leave: LayoutItem[] = [];

  for (const item of currVisible) {
    if (!prevSet.has(item.hash)) {
      enter.push(item);
    }
  }

  for (const item of prevVisible) {
    if (!currSet.has(item.hash)) {
      leave.push(item);
    }
  }

  return { enter, leave };
}
