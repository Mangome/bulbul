import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RightControlPanel } from './RightControlPanel';
import { useCanvasStore } from '../../stores/useCanvasStore';

const noop = vi.fn();

describe('RightControlPanel', () => {
  beforeEach(() => {
    useCanvasStore.setState({ zoomLevel: 1.0, currentGroupIndex: 0, groupCount: 3 });
    noop.mockClear();
  });

  it('显示当前缩放百分比', () => {
    render(<RightControlPanel onSwitchFolder={noop} />);
    expect(screen.getByText('100%')).toBeDefined();
  });

  it('点击适应窗口调用 fitToWindow', () => {
    render(<RightControlPanel onSwitchFolder={noop} />);
    fireEvent.click(screen.getByTitle('适应窗口'));
    const state = useCanvasStore.getState();
    expect(state.zoomLevel).toBe(1.0);
  });

  it('点击实际大小调用 resetZoom', () => {
    useCanvasStore.setState({ zoomLevel: 2.0 });
    render(<RightControlPanel onSwitchFolder={noop} />);
    fireEvent.click(screen.getByTitle('实际大小'));
    expect(useCanvasStore.getState().zoomLevel).toBe(1.0);
  });

  it('主题切换按钮存在', () => {
    render(<RightControlPanel onSwitchFolder={noop} />);
    const themeBtn = screen.getByTitle(/切换暗色主题|切换亮色主题/);
    expect(themeBtn).toBeDefined();
  });

  it('点击切换目录按钮调用 onSwitchFolder', () => {
    render(<RightControlPanel onSwitchFolder={noop} />);
    fireEvent.click(screen.getByTitle('切换目录 (Ctrl+O)'));
    expect(noop).toHaveBeenCalledOnce();
  });
});
