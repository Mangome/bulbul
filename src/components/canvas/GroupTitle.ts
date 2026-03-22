// ============================================================
// 分组标题渲染
//
// 在每个分组区域顶部显示"分组 N（M 张）"文本
// ============================================================

import { Container, Text, type TextStyleOptions } from 'pixi.js';
import type { GroupTitleItem } from '../../utils/layout';

const TITLE_STYLE: TextStyleOptions = {
  fontSize: 16,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fill: 0x374151,
  fontWeight: '700',
};

export class GroupTitle extends Container {
  constructor(titleItem: GroupTitleItem) {
    super();

    const text = new Text({ text: titleItem.label, style: TITLE_STYLE });
    text.x = titleItem.x;
    text.y = titleItem.y + (titleItem.height - text.height) / 2;

    this.addChild(text);
  }
}
