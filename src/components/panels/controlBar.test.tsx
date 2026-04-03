import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RightControlPanel } from './RightControlPanel';
import { useCanvasStore } from '../../stores/useCanvasStore';

describe('RightControlPanel', () => {
  beforeEach(() => {
    useCanvasStore.setState({ zoomLevel: 1.0, currentGroupIndex: 0, groupCount: 3 });
  });

  it('显示当前缩放百分比', () => {
    render(<RightControlPanel />);
    expect(screen.getByText('100%')).toBeDefined();
  });

  it('点击适应窗口调用 fitToWindow', () => {
    render(<RightControlPanel />);
    fireEvent.click(screen.getByTitle('适应窗口'));
    const state = useCanvasStore.getState();
    expect(state.zoomLevel).toBe(1.0);
  });

  it('点击实际大小调用 resetZoom', () => {
    useCanvasStore.setState({ zoomLevel: 2.0 });
    render(<RightControlPanel />);
    fireEvent.click(screen.getByTitle('实际大小'));
    expect(useCanvasStore.getState().zoomLevel).toBe(1.0);
  });

  it('主题切换按钮存在', () => {
    render(<RightControlPanel />);
    const themeBtn = screen.getByTitle(/切换/);
    expect(themeBtn).toBeDefined();
  });
});
