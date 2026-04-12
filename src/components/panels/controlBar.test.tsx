import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RightControlPanel } from './RightControlPanel';
import { useCanvasStore } from '../../stores/useCanvasStore';

// Mock Tauri event API to prevent unhandled rejections in test
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve({})),
}));

const noop = vi.fn();

describe('RightControlPanel', () => {
  beforeEach(() => {
    useCanvasStore.setState({ currentGroupIndex: 0, groupCount: 3 });
    noop.mockClear();
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

  it('检测框切换按钮存在', () => {
    render(<RightControlPanel onSwitchFolder={noop} />);
    const detectionBtn = screen.getByTitle(/显示检测框|隐藏检测框/);
    expect(detectionBtn).toBeDefined();
  });
});
