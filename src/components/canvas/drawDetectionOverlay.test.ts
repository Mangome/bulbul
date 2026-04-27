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

  it('高置信鸟种框为绿色', () => {
    const boxes: DetectionBox[] = [
      { x1: 0.2, y1: 0.1, x2: 0.8, y2: 0.9, confidence: 0.95, speciesName: '白头鹎', speciesConfidence: 0.92 },
    ];
    drawDetectionOverlay(ctx, boxes, 400, 300);

    expect(ctx.strokeStyle).toBe('#22C55E');
  });

  it('低置信鸟种框为橙色', () => {
    const boxes: DetectionBox[] = [
      { x1: 0.2, y1: 0.1, x2: 0.8, y2: 0.9, confidence: 0.95, speciesName: '白头鹎', speciesConfidence: 0.60 },
    ];
    drawDetectionOverlay(ctx, boxes, 400, 300);

    expect(ctx.strokeStyle).toBe('#F97316');
  });

  it('鸟种置信度低于50%时显示为仅检测框（黄色），不显示鸟种名称', () => {
    const boxes: DetectionBox[] = [
      { x1: 0.2, y1: 0.1, x2: 0.8, y2: 0.9, confidence: 0.95, speciesName: '白头鹎', speciesConfidence: 0.40 },
    ];
    drawDetectionOverlay(ctx, boxes, 400, 300);

    expect(ctx.strokeStyle).toBe('#EAB308');
    const fillTextCalls = (ctx.fillText as any).mock.calls;
    expect(fillTextCalls.length).toBe(0);
  });

  it('鸟种置信度正好50%显示为低置信（橙色）', () => {
    const boxes: DetectionBox[] = [
      { x1: 0.2, y1: 0.1, x2: 0.8, y2: 0.9, confidence: 0.95, speciesName: '白头鹎', speciesConfidence: 0.50 },
    ];
    drawDetectionOverlay(ctx, boxes, 400, 300);

    expect(ctx.strokeStyle).toBe('#F97316');
  });

  it('仅检测框（无鸟种名）为黄色', () => {
    const boxes: DetectionBox[] = [
      { x1: 0.2, y1: 0.1, x2: 0.8, y2: 0.9, confidence: 0.95 },
    ];
    drawDetectionOverlay(ctx, boxes, 400, 300);

    expect(ctx.strokeStyle).toBe('#EAB308');
  });

  it('鸟种置信度正好 85% 视为高置信（绿色）', () => {
    const boxes: DetectionBox[] = [
      { x1: 0.2, y1: 0.1, x2: 0.8, y2: 0.9, confidence: 0.95, speciesName: '红嘴蓝鹊', speciesConfidence: 0.85 },
    ];
    drawDetectionOverlay(ctx, boxes, 400, 300);

    expect(ctx.strokeStyle).toBe('#22C55E');
  });

  it('鸟种置信度 84% 视为低置信（橙色）', () => {
    const boxes: DetectionBox[] = [
      { x1: 0.2, y1: 0.1, x2: 0.8, y2: 0.9, confidence: 0.95, speciesName: '红嘴蓝鹊', speciesConfidence: 0.84 },
    ];
    drawDetectionOverlay(ctx, boxes, 400, 300);

    expect(ctx.strokeStyle).toBe('#F97316');
  });

  it('高置信标签无问号：白头鹎 92%', () => {
    const boxes: DetectionBox[] = [
      { x1: 0.2, y1: 0.2, x2: 0.8, y2: 0.8, confidence: 0.95, speciesName: '白头鹎', speciesConfidence: 0.92 },
    ];
    drawDetectionOverlay(ctx, boxes, 400, 300);

    const fillTextCalls = (ctx.fillText as any).mock.calls;
    expect(fillTextCalls.length).toBeGreaterThan(0);
    expect(fillTextCalls[0][0]).toBe('白头鹎 92%');
  });

  it('低置信标签带问号：白头鹎? 55%', () => {
    const boxes: DetectionBox[] = [
      { x1: 0.2, y1: 0.2, x2: 0.8, y2: 0.8, confidence: 0.95, speciesName: '白头鹎', speciesConfidence: 0.55 },
    ];
    drawDetectionOverlay(ctx, boxes, 400, 300);

    const fillTextCalls = (ctx.fillText as any).mock.calls;
    expect(fillTextCalls.length).toBeGreaterThan(0);
    expect(fillTextCalls[0][0]).toBe('白头鹎? 55%');
  });

  it('仅检测框（detect 级别）不显示文本标签', () => {
    const boxes: DetectionBox[] = [
      { x1: 0.2, y1: 0.2, x2: 0.8, y2: 0.8, confidence: 0.95 },
    ];
    drawDetectionOverlay(ctx, boxes, 400, 300);

    const fillTextCalls = (ctx.fillText as any).mock.calls;
    expect(fillTextCalls.length).toBe(0);
  });

  it('鸟种名存在但无 speciesConfidence 时使用 detection confidence 判定等级', () => {
    const boxes: DetectionBox[] = [
      // 无 speciesConfidence 时 fallback 到 confidence=0.70 < 0.85 → 低置信橙色
      { x1: 0.2, y1: 0.2, x2: 0.8, y2: 0.8, confidence: 0.70, speciesName: '红嘴蓝鹊' },
    ];
    drawDetectionOverlay(ctx, boxes, 400, 300);

    expect(ctx.strokeStyle).toBe('#F97316');
    const fillTextCalls = (ctx.fillText as any).mock.calls;
    expect(fillTextCalls[0][0]).toBe('红嘴蓝鹊? 70%');
  });

  it('多个不同等级的框各自显示对应颜色', () => {
    const boxes: DetectionBox[] = [
      { x1: 0.0, y1: 0.0, x2: 0.3, y2: 0.3, confidence: 0.9, speciesName: '麻雀', speciesConfidence: 0.92 },
      { x1: 0.3, y1: 0.3, x2: 0.6, y2: 0.6, confidence: 0.9, speciesName: '喜鹊', speciesConfidence: 0.60 },
      { x1: 0.6, y1: 0.6, x2: 0.9, y2: 0.9, confidence: 0.9 },
    ];
    drawDetectionOverlay(ctx, boxes, 400, 300);

    // 每个框 5 次 stroke（边框 + 4 折角），共 15 次
    expect((ctx.stroke as any).mock.calls.length).toBe(15);
    // detect 级别不绘制标签，只有 2 个标签
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

  it('标签位置在框上方不足时向下调整', () => {
    const boxes: DetectionBox[] = [
      { x1: 0.1, y1: 0.0, x2: 0.5, y2: 0.5, confidence: 0.95, speciesName: '白头鹎', speciesConfidence: 0.92 },
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
