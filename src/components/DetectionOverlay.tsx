import { useImperativeHandle, forwardRef, useRef, useEffect } from 'react';
import { Container, Graphics } from 'pixi.js';
import type { DetectionBox as DetectionBoxType } from '../types';

// ─── 常量 ─────────────────────────────────────────────

/** 主框颜色（置信度最高的框） */
const PRIMARY_BOX_COLOR = 0x22C55E; // 绿色
/** 副框颜色（其他检测框） */
const SECONDARY_BOX_COLOR = 0xEAB308; // 黄色
/** 框线宽度 */
const BOX_LINE_WIDTH = 2;
/** 折角（边框转角处） */
const CORNER_SIZE = 12;
/** 标签背景色 */
const LABEL_BG_COLOR = 0x000000;
/** 标签背景透明度 */
const LABEL_BG_ALPHA = 0.7;
/** 最小框尺寸（像素），过小不绘制 */
const MIN_BOX_SIZE = 10;

export interface DetectionOverlayInstance {
  show(): void;
  hide(): void;
  update(bboxes: DetectionBoxType[], displayWidth: number, displayHeight: number, zoomLevel: number): void;
}

interface DetectionOverlayProps {
  bboxes: DetectionBoxType[];
  displayWidth: number;
  displayHeight: number;
  zoomLevel: number;
}

/**
 * 绘制单个检测框
 */
function drawDetectionBox(
  graphics: Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  confidence: number,
  isPrimary: boolean,
  displayWidth: number,
  displayHeight: number,
) {
  const color = isPrimary ? PRIMARY_BOX_COLOR : SECONDARY_BOX_COLOR;
  const width = x2 - x1;
  const height = y2 - y1;

  // 检查最小尺寸
  if (width * displayWidth < MIN_BOX_SIZE || height * displayHeight < MIN_BOX_SIZE) {
    return;
  }

  // 转换为像素坐标
  const px1 = x1 * displayWidth;
  const py1 = y1 * displayHeight;
  const px2 = x2 * displayWidth;
  const py2 = y2 * displayHeight;

  // 绘制边框（带折角）
  graphics.lineStyle(BOX_LINE_WIDTH, color, 1.0);
  graphics.setStrokeStyle({ width: BOX_LINE_WIDTH, color });

  // 左上角
  graphics.moveTo(px1 + CORNER_SIZE, py1);
  graphics.lineTo(px2 - CORNER_SIZE, py1);
  graphics.lineTo(px2, py1);
  graphics.lineTo(px2, py1 + CORNER_SIZE);
  graphics.lineTo(px2, py2 - CORNER_SIZE);
  graphics.lineTo(px2, py2);
  graphics.lineTo(px2 - CORNER_SIZE, py2);
  graphics.lineTo(px1 + CORNER_SIZE, py2);
  graphics.lineTo(px1, py2);
  graphics.lineTo(px1, py2 - CORNER_SIZE);
  graphics.lineTo(px1, py1 + CORNER_SIZE);
  graphics.lineTo(px1, py1);
  graphics.lineTo(px1 + CORNER_SIZE, py1);
  graphics.stroke();

  // 绘制标签（"Bird: XX%"）
  const confText = `Bird: ${Math.round(confidence * 100)}%`;
  const labelPadding = 6;
  const labelFontSize = 12;
  const labelX = px1 + 4;
  const labelY = Math.max(py1 - labelFontSize - labelPadding - 2, 0);

  // 标签背景
  graphics.rect(
    labelX - labelPadding,
    labelY - labelFontSize / 2,
    confText.length * 6 + labelPadding * 2,
    labelFontSize + labelPadding,
  );
  graphics.fill({ color: LABEL_BG_COLOR, alpha: LABEL_BG_ALPHA });
}

/**
 * DetectionOverlay - Pixi Graphics 绘制检测框
 *
 * 主要功能：
 * - 绘制所有检测框（矩形 + 标签）
 * - 区分主框（绿色）和副框（黄色）
 * - 考虑缩放级别进行坐标映射
 * - 缓存 Graphics 对象，避免频繁重绘
 */
export const DetectionOverlay = forwardRef<DetectionOverlayInstance, DetectionOverlayProps>(
  (_props, ref) => {
    const graphicsRef = useRef<Graphics | null>(null);
    const containerRef = useRef<Container | null>(null);
    const isVisibleRef = useRef(false);

    // 初始化 Graphics
    useEffect(() => {
      if (!graphicsRef.current) {
        const graphics = new Graphics();
        graphicsRef.current = graphics;

        const container = new Container();
        container.addChild(graphics);
        containerRef.current = container;
      }
    }, []);

    // 暴露公开方法
    useImperativeHandle(ref, () => ({
      show() {
        if (containerRef.current) {
          containerRef.current.visible = true;
          isVisibleRef.current = true;
        }
      },
      hide() {
        if (containerRef.current) {
          containerRef.current.visible = false;
          isVisibleRef.current = false;
        }
      },
      update(newBboxes: DetectionBoxType[], newDisplayWidth: number, newDisplayHeight: number) {
        if (!graphicsRef.current) return;

        // 清空之前的绘制
        graphicsRef.current.clear();

        if (newBboxes.length === 0) {
          return;
        }

        // 按置信度排序，找到主框（最高置信度）
        const maxConfidence = Math.max(...newBboxes.map((b) => b.confidence));

        // 绘制所有框
        for (const bbox of newBboxes) {
          const isPrimary = bbox.confidence === maxConfidence;
          drawDetectionBox(
            graphicsRef.current,
            bbox.x1,
            bbox.y1,
            bbox.x2,
            bbox.y2,
            bbox.confidence,
            isPrimary,
            newDisplayWidth,
            newDisplayHeight,
          );
        }
      },
    }), []);

    return null; // 无需渲染 React 元素，直接操作 Pixi
  },
);

DetectionOverlay.displayName = 'DetectionOverlay';
