// ============================================================
// 分组标题渲染
//
// 在每个分组区域顶部显示"分组 N（M 张）"文本
// ============================================================

import { Container, Text, type TextStyleOptions } from 'pixi.js';
import type { GroupTitleItem } from '../../utils/layout';

const TITLE_PADDING = 16;

const TITLE_STYLE: TextStyleOptions = {
  fontSize: 16,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fill: 0x374151,
  fontWeight: '700',
};

export class GroupTitle extends Container {
  constructor(titleItem: GroupTitleItem) {
    super();

    // 限制文本宽度，防止长标题溢出
    const maxWidth = Math.max(100, titleItem.width - TITLE_PADDING * 2);
    const label = truncateGroupLabel(titleItem.label, maxWidth);

    const text = new Text({ text: label, style: TITLE_STYLE });
    text.x = titleItem.x;
    text.y = titleItem.y + (titleItem.height - text.height) / 2;

    this.addChild(text);
  }
}

/**
 * 截断分组标题以适应 maxWidth（像素）。
 * 逐步缩短直到 Text 宽度不超过限制。
 */
function truncateGroupLabel(label: string, maxWidthPx: number): string {
  // 快速估算：fontSize 16 时约 9px/字符（中文更宽约 16px）
  // 先做字符级粗估，避免创建过多 Text 对象
  const estimatedCharWidth = 10;
  const estimatedMaxChars = Math.floor(maxWidthPx / estimatedCharWidth);

  if (label.length <= estimatedMaxChars) return label;
  if (estimatedMaxChars < 8) return label.substring(0, 5) + '...';
  return label.substring(0, estimatedMaxChars - 3) + '...';
}
