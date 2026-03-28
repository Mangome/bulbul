// ============================================================
// 视口裁剪引擎 (水平分组模式)
//
// 基于分组页面偏移确定可见分组，
// 组内按 Y 坐标二分搜索定位可见元素。
// 支持增量 diff (enter/leave) 算法。
// ============================================================

import type { LayoutItem, GroupPageLayout } from '../utils/layout';

// ─── 类型 ─────────────────────────────────────────────

/** 视口矩形 (ContentLayer 坐标系) */
export interface ViewportRect {
  x: number;
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

// ─── 可见分组查询 ─────────────────────────────────────

/**
 * 获取当前可见的分组索引范围
 *
 * @param pages 所有分组页面
 * @param pageWidth 单页宽度
 * @param viewportX 视口 X 坐标
 * @param viewportWidth 视口宽度
 * @returns [minGroupIndex, maxGroupIndex] 闭区间
 */
export function getVisibleGroupRange(
  pages: GroupPageLayout[],
  pageWidth: number,
  viewportX: number,
  viewportWidth: number,
): [number, number] {
  if (pages.length === 0) return [0, -1];

  const minGroup = Math.max(0, Math.floor(viewportX / pageWidth));
  const maxGroup = Math.min(
    pages.length - 1,
    Math.floor((viewportX + viewportWidth) / pageWidth),
  );

  return [minGroup, maxGroup];
}

// ─── 组内可见元素查询 ─────────────────────────────────

/**
 * 获取指定分组页面内视口可见（含缓冲区）的元素
 *
 * @param page 分组页面
 * @param viewportY 视口 Y 坐标
 * @param viewportHeight 视口高度
 * @param bufferRatio 缓冲区比例（视口高度的倍数，默认 0.5）
 * @returns 可见的 LayoutItem 数组
 */
export function getVisibleItemsInPage(
  page: GroupPageLayout,
  viewportY: number,
  viewportHeight: number,
  bufferRatio: number = 0.5,
): LayoutItem[] {
  if (page.sortedItems.length === 0) return [];

  const buffer = viewportHeight * bufferRatio;
  const minY = viewportY - buffer;
  const maxY = viewportY + viewportHeight + buffer;

  const result: LayoutItem[] = [];
  const startIdx = lowerBound(page.sortedItems, minY);

  for (let i = startIdx; i < page.sortedItems.length; i++) {
    const item = page.sortedItems[i];
    if (item.y > maxY) break;
    result.push(item);
  }

  return result;
}

// ─── 综合可见元素查询 ─────────────────────────────────

/**
 * 获取所有可见分组中的可见元素
 *
 * @param pages 所有分组页面
 * @param pageWidth 单页宽度
 * @param viewport 视口矩形
 * @param bufferRatio 缓冲区比例（默认 0.5）
 * @returns 所有可见的 LayoutItem 数组
 */
export function getVisibleItems(
  pages: GroupPageLayout[],
  pageWidth: number,
  viewport: ViewportRect,
  bufferRatio: number = 0.5,
): LayoutItem[] {
  if (pages.length === 0) return [];

  const [minGroup, maxGroup] = getVisibleGroupRange(
    pages,
    pageWidth,
    viewport.x,
    viewport.width,
  );

  const result: LayoutItem[] = [];

  for (let gi = minGroup; gi <= maxGroup; gi++) {
    const page = pages[gi];
    const pageItems = getVisibleItemsInPage(
      page,
      viewport.y,
      viewport.height,
      bufferRatio,
    );
    result.push(...pageItems);
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
