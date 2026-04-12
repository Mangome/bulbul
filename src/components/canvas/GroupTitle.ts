// ============================================================
// 分组标题渲染（缩略图模式）
//
// 在每个分组区域顶部显示"分组 N（M 张）"文本
// 使用 Canvas 2D fillText 直接绘制，无 PixiJS 依赖。
// ============================================================

import type { GroupTitleItem } from '../../utils/layout';

// ─── 配置 ─────────────────────────────────────────────

const TITLE_PADDING = 8;
const TITLE_FONT = '600 14px system-ui, -apple-system, sans-serif';
const TITLE_COLOR = '#374151';
const COMPACT_TITLE_FONT = '500 12px system-ui, -apple-system, sans-serif';
const COMPACT_TITLE_COLOR = '#6B7280';

// ─── 绘制函数 ─────────────────────────────────────────

/**
 * 绘制所有分组标题。
 * 在 InfiniteCanvas 渲染循环中、内容层变换后调用。
 */
export function drawGroupTitles(
  ctx: CanvasRenderingContext2D,
  titles: GroupTitleItem[],
): void {
  ctx.textBaseline = 'middle';

  for (const item of titles) {
    if (item.compact) {
      ctx.font = COMPACT_TITLE_FONT;
      ctx.fillStyle = COMPACT_TITLE_COLOR;
    } else {
      ctx.font = TITLE_FONT;
      ctx.fillStyle = TITLE_COLOR;
    }
    const maxWidth = Math.max(100, item.width - TITLE_PADDING * 2);
    const label = truncateGroupLabel(item.label, maxWidth);
    const cy = item.y + item.height / 2;
    ctx.fillText(label, item.x + TITLE_PADDING, cy);
  }
}

/**
 * 截断分组标题以适应 maxWidth（像素）。
 * 使用字符宽度估算，避免每帧调用 measureText。
 */
function truncateGroupLabel(label: string, maxWidthPx: number): string {
  const estimatedCharWidth = 8;
  const estimatedMaxChars = Math.floor(maxWidthPx / estimatedCharWidth);

  if (label.length <= estimatedMaxChars) return label;
  if (estimatedMaxChars < 8) return label.substring(0, 5) + '...';
  return label.substring(0, estimatedMaxChars - 3) + '...';
}
