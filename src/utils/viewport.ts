// ============================================================
// 视口裁剪引擎
//
// 基于排序后的 Y 坐标数组做二分搜索，快速定位视口内元素。
// 支持缓冲区、增量 diff (enter/leave) 算法。
// ============================================================

import type { LayoutItem } from '../utils/layout';

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

// ─── 排序索引 ─────────────────────────────────────────

/**
 * 按 Y 坐标排序的布局索引
 *
 * 构建时排序一次，后续查询复用。
 */
export interface SortedLayoutIndex {
  /** 按 y 坐标升序排列的 LayoutItem 引用 */
  items: LayoutItem[];
}

/** 构建排序索引 */
export function buildSortedIndex(items: LayoutItem[]): SortedLayoutIndex {
  const sorted = [...items].sort((a, b) => a.y - b.y);
  return { items: sorted };
}

// ─── 二分搜索 ─────────────────────────────────────────

/**
 * 二分搜索：找到第一个 y + height >= minY 的元素索引
 *
 * 即找到底边可能进入视口的第一个元素。
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

// ─── 可见元素查询 ─────────────────────────────────────

/**
 * 获取视口内（含缓冲区）的可见元素集合
 *
 * @param index 排序后的布局索引
 * @param viewport 视口矩形
 * @param bufferRatio 缓冲区比例（视口高度的倍数，默认 0.5）
 * @returns 可见的 LayoutItem 数组
 */
export function getVisibleItems(
  index: SortedLayoutIndex,
  viewport: ViewportRect,
  bufferRatio: number = 0.5,
): LayoutItem[] {
  if (index.items.length === 0) return [];

  const buffer = viewport.height * bufferRatio;
  const minY = viewport.y - buffer;
  const maxY = viewport.y + viewport.height + buffer;
  const minX = viewport.x;
  const maxX = viewport.x + viewport.width;

  const result: LayoutItem[] = [];

  // 从二分搜索定位开始，向后扫描
  const startIdx = lowerBound(index.items, minY);

  for (let i = startIdx; i < index.items.length; i++) {
    const item = index.items[i];

    // 顶边超过 maxY：后续元素 y 更大，可停止
    if (item.y > maxY) break;

    // X 轴相交检查
    if (item.x + item.width > minX && item.x < maxX) {
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
