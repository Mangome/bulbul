import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Toast } from './Toast';
import { ErrorBoundary } from './ErrorBoundary';
import { useToastStore, type ToastItem } from '../../stores/useToastStore';

// ── Toast 组件测试 ──

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const makeToast = (overrides?: Partial<ToastItem>): ToastItem => ({
    id: 'test-1',
    type: 'success',
    message: '操作成功',
    duration: 3000,
    ...overrides,
  });

  it('应渲染消息文本', () => {
    const toast = makeToast({ message: '导出完成' });
    useToastStore.setState({ toasts: [toast] });
    render(<Toast toast={toast} />);
    expect(screen.getByText('导出完成')).toBeTruthy();
  });

  it('应渲染关闭按钮', () => {
    const toast = makeToast();
    useToastStore.setState({ toasts: [toast] });
    render(<Toast toast={toast} />);
    expect(screen.getByRole('button', { name: '关闭' })).toBeTruthy();
  });

  it('点击关闭按钮应移除 Toast', () => {
    const toast = makeToast();
    useToastStore.setState({ toasts: [toast] });
    render(<Toast toast={toast} />);

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('应在 duration 后自动移除', () => {
    const toast = makeToast({ duration: 3000 });
    useToastStore.setState({ toasts: [toast] });
    render(<Toast toast={toast} />);

    expect(useToastStore.getState().toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('鼠标进入应暂停计时器', () => {
    const toast = makeToast({ duration: 3000 });
    useToastStore.setState({ toasts: [toast] });
    render(<Toast toast={toast} />);

    // 过了 1 秒后鼠标进入
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.mouseEnter(screen.getByRole('status'));

    // 再过 5 秒，不应移除（因为暂停了）
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('应正确应用类型样式', () => {
    const toast = makeToast({ type: 'error' });
    useToastStore.setState({ toasts: [toast] });
    render(<Toast toast={toast} />);
    const el = screen.getByRole('alert');
    expect(el.className).toContain('error');
  });
});

// ── ErrorBoundary 组件测试 ──

describe('ErrorBoundary', () => {
  // 抑制错误边界测试期间的 console.error 输出
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalError;
  });

  function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
    if (shouldThrow) throw new Error('测试渲染错误');
    return <div>正常内容</div>;
  }

  it('应正常渲染子组件', () => {
    render(
      <ErrorBoundary>
        <div>正常内容</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('正常内容')).toBeTruthy();
  });

  it('应捕获渲染错误并显示回退 UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('出现了意外错误')).toBeTruthy();
    expect(screen.getByText('测试渲染错误')).toBeTruthy();
  });

  it('应显示重试按钮', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('重试')).toBeTruthy();
  });

  it('应将错误输出到 console.error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(console.error).toHaveBeenCalled();
  });
});
