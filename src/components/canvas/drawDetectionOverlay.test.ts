import { describe, it, expect, vi, beforeEach } from 'vitest';
import { drawDetectionOverlay } from './drawDetectionOverlay';
import type { DetectionBox } from '../../types';

/** 创建 mock CanvasRenderingContext2D */
function createMockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    quadraticCurveTo: vi.fn(),
    measureText: vi.fn(() => ({ width: 60 })),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineJoin: '' as CanvasLineJoin,
    globalAlpha: 1,
    font: '',
    textBaseline: '' as CanvasTextBaseline,
  } as unknown as CanvasRenderingContext2D;
}

describe('drawDetectionOverlay', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = createMockCtx();
  });

  it('空数组不执行任何绘制', () => {
    drawDetectionOverlay(ctx, [], 400, 300);
    expect((ctx.save as any).mock.calls.length).toBe(0);
    expect((ctx.stroke as any).mock.calls.length).toBe(0);
  });

  it('单个检测框绘制为主框（绿色）', () => {
    const boxes: DetectionBox[] = [
      { x1: 0.2, y1: 0.1, x2: 0.8, y2: 0.9, confidence: 0.95 },
    ];
    drawDetectionOverlay(ctx, boxes, 400, 300);

    // 应该有 stroke 调用（边框 + 4 个折角 = 5 次）
    expect((ctx.stroke as any).mock.calls.length).toBe(5);
    // strokeStyle 应该被设置为绿色
    expect(ctx.strokeStyle).toBe('#22C55E');
  });

  it('多个检测框区分主框（绿色）和副框（黄色）', () => {
    const boxes: DetectionBox[] = [
      { x1: 0.1, y1: 0.1, x2: 0.5, y2: 0.5, confidence: 0.8 },
      { x1: 0.5, y1: 0.5, x2: 0.9, y2: 0.9, confidence: 0.95 },
    ];
    drawDetectionOverlay(ctx, boxes, 400, 300);

    // 应该有 10 次 stroke 调用（每个框 5 次）
    expect((ctx.stroke as any).mock.calls.length).toBe(10);
    // 应该有 fillText 调用（标签文字）
    expect((ctx.fillText as any).mock.calls.length).toBe(2);
  });

  it('过小的框不绘制（< 10px）', () => {
    const boxes: DetectionBox[] = [
      { x1: 0.0, y1: 0.0, x2: 0.01, y2: 0.01, confidence: 0.9 },
    ];
    // 400 * 0.01 = 4px < 10px
    drawDetectionOverlay(ctx, boxes, 400, 300);

    // save 被调用但不应有 stroke（框被跳过）
    expect((ctx.stroke as any).mock.calls.length).toBe(0);
  });

  it('正常尺寸的框执行绘制', () => {
    const boxes: DetectionBox[] = [
      { x1: 0.0, y1: 0.0, x2: 0.1, y2: 0.1, confidence: 0.9 },
    ];
    // 400 * 0.1 = 40px >= 10px
    drawDetectionOverlay(ctx, boxes, 400, 300);

    expect((ctx.stroke as any).mock.calls.length).toBe(5);
  });

  it('置信度标签包含正确的百分比文本', () => {
    const boxes: DetectionBox[] = [
      { x1: 0.2, y1: 0.2, x2: 0.8, y2: 0.8, confidence: 0.95 },
    ];
    drawDetectionOverlay(ctx, boxes, 400, 300);

    // fillText 应包含 "Bird: 95%"
    const fillTextCalls = (ctx.fillText as any).mock.calls;
    expect(fillTextCalls.length).toBeGreaterThan(0);
    expect(fillTextCalls[0][0]).toBe('Bird: 95%');
  });

  it('标签位置在框上方不足时向下调整', () => {
    const boxes: DetectionBox[] = [
      { x1: 0.1, y1: 0.0, x2: 0.5, y2: 0.5, confidence: 0.9 },
    ];
    // y1 = 0, 框顶部在最上方，标签应该向下调整
    drawDetectionOverlay(ctx, boxes, 400, 300);

    const fillTextCalls = (ctx.fillText as any).mock.calls;
    expect(fillTextCalls.length).toBeGreaterThan(0);
    // 标签 Y 坐标应该 >= 0（已向下调整）
    const labelY = fillTextCalls[0][2]; // fillText(text, x, y)
    expect(labelY).toBeGreaterThanOrEqual(0);
  });
});
