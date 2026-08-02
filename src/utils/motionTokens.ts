// ============================================================
// 动效令牌 JS 桥接（方案 A · Token Lock）
//
// 与 src/styles/variables.css 的动效矩阵保持同步的唯一事实来源。
// motion 组件内禁止书写字面量时长 / 贝塞尔曲线，一律引用本文件。
// 规范：docs/design-proposals/proposal-a/design-language.md
// ============================================================

/** 时长（秒）—— 对应 --duration-press / fast / normal / slow */
export const DURATION = {
  press: 0.08,
  fast: 0.12,
  normal: 0.2,
  slow: 0.3,
} as const;

/** 缓动 —— 对应 --ease-*；bounce 仅限 CSS 侧 :active 按压，JS 侧不导出 */
export const EASE: Record<'standard' | 'outQuint' | 'swift', [number, number, number, number]> = {
  standard: [0.4, 0, 0.2, 1],
  outQuint: [0.22, 1, 0.36, 1],
  swift: [0.25, 1, 0.5, 1],
};
