import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingControlBar } from './FloatingControlBar';
import { useCanvasStore } from '../../stores/useCanvasStore';

describe('FloatingControlBar', () => {
  beforeEach(() => {
    useCanvasStore.setState({ zoomLevel: 1.0, currentGroupIndex: 0, groupCount: 3 });
  });

  it('显示当前缩放百分比', () => {
    render(<FloatingControlBar />);
    expect(screen.getByText('100%')).toBeDefined();
  });

  it('显示分组进度圆点', () => {
    render(<FloatingControlBar />);
    const dots = screen.getAllByTitle(/第 \d+ 组/);
    expect(dots).toHaveLength(3);
  });

  it('点击进度圆点切换分组', () => {
    render(<FloatingControlBar />);
    const dot2 = screen.getByTitle('第 2 组');
    fireEvent.click(dot2);
    expect(useCanvasStore.getState().currentGroupIndex).toBe(1);
  });

  it('点击适应窗口调用 fitToWindow', () => {
    render(<FloatingControlBar />);
    fireEvent.click(screen.getByText('适应窗口'));
    const state = useCanvasStore.getState();
    expect(state.zoomLevel).toBe(1.0);
  });

  it('点击实际大小调用 resetZoom', () => {
    useCanvasStore.setState({ zoomLevel: 2.0 });
    render(<FloatingControlBar />);
    fireEvent.click(screen.getByText('实际大小'));
    expect(useCanvasStore.getState().zoomLevel).toBe(1.0);
  });

  it('缩放按钮工作正常', () => {
    render(<FloatingControlBar />);
    fireEvent.click(screen.getByText('+'));
    expect(useCanvasStore.getState().zoomLevel).toBeCloseTo(1.1, 1);
  });

  it('主题切换按钮存在', () => {
    render(<FloatingControlBar />);
    // 应该有一个主题切换按钮
    const themeBtn = screen.getByTitle(/切换/);
    expect(themeBtn).toBeDefined();
  });
});
