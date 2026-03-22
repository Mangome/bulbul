import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingControlBar } from './FloatingControlBar';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useSelectionStore } from '../../stores/useSelectionStore';

describe('FloatingControlBar', () => {
  beforeEach(() => {
    useCanvasStore.setState({ zoomLevel: 1.0 });
    useSelectionStore.setState({
      selectedHashes: new Set<string>(),
      selectedCount: 0,
    });
  });

  it('显示当前缩放百分比', () => {
    render(<FloatingControlBar onExport={() => {}} />);
    expect(screen.getByText('100%')).toBeDefined();
  });

  it('导出按钮在无选中时 disabled', () => {
    render(<FloatingControlBar onExport={() => {}} />);
    const exportBtn = screen.getByText('导出').closest('button')!;
    expect(exportBtn.disabled).toBe(true);
  });

  it('有选中图片时导出按钮可用', () => {
    useSelectionStore.setState({
      selectedHashes: new Set(['h1', 'h2']),
      selectedCount: 2,
    });
    render(<FloatingControlBar onExport={() => {}} />);
    const exportBtn = screen.getByText('导出').closest('button')!;
    expect(exportBtn.disabled).toBe(false);
  });

  it('有选中时显示数量 Badge', () => {
    useSelectionStore.setState({
      selectedHashes: new Set(['h1', 'h2', 'h3']),
      selectedCount: 3,
    });
    render(<FloatingControlBar onExport={() => {}} />);
    expect(screen.getByText('3')).toBeDefined();
  });

  it('点击导出按钮触发 onExport', () => {
    useSelectionStore.setState({
      selectedHashes: new Set(['h1']),
      selectedCount: 1,
    });
    const onExport = vi.fn();
    render(<FloatingControlBar onExport={onExport} />);
    fireEvent.click(screen.getByText('导出').closest('button')!);
    expect(onExport).toHaveBeenCalledOnce();
  });

  it('点击适应窗口调用 fitToWindow', () => {
    render(<FloatingControlBar onExport={() => {}} />);
    fireEvent.click(screen.getByText('适应窗口'));
    const state = useCanvasStore.getState();
    // fitToWindow 重置 zoomLevel 为 1.0
    expect(state.zoomLevel).toBe(1.0);
  });

  it('点击实际大小调用 resetZoom', () => {
    useCanvasStore.setState({ zoomLevel: 2.0 });
    render(<FloatingControlBar onExport={() => {}} />);
    fireEvent.click(screen.getByText('实际大小'));
    expect(useCanvasStore.getState().zoomLevel).toBe(1.0);
  });
});
