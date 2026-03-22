import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';
import { Slider } from './Slider';
import { Badge } from './Badge';

// ─── Button ───────────────────────────────────────────

describe('Button', () => {
  it('渲染 children 文本', () => {
    render(<Button>导出</Button>);
    expect(screen.getByText('导出')).toBeDefined();
  });

  it('点击触发 onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>点我</Button>);
    fireEvent.click(screen.getByText('点我'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('disabled 时不触发 onClick', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>禁用</Button>);
    fireEvent.click(screen.getByText('禁用'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disabled 时 button 元素有 disabled 属性', () => {
    render(<Button disabled>禁用</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveProperty('disabled', true);
  });

  it('primary variant 渲染蓝色背景', () => {
    render(<Button variant="primary">主要</Button>);
    const btn = screen.getByRole('button');
    const styleAttr = btn.getAttribute('style') ?? '';
    // jsdom 将 #3B82F6 转为 rgb(59, 130, 246)
    expect(styleAttr).toContain('rgb(59, 130, 246)');
  });

  it('ghost variant 渲染透明背景', () => {
    render(<Button variant="ghost">幽灵</Button>);
    const btn = screen.getByRole('button');
    const styleAttr = btn.getAttribute('style') ?? '';
    expect(styleAttr).toContain('transparent');
  });

  it('sm size 使用更小的 padding', () => {
    render(<Button size="sm">小按钮</Button>);
    const btn = screen.getByRole('button');
    expect(btn.style.padding).toBe('4px 10px');
  });
});

// ─── Slider ───────────────────────────────────────────

describe('Slider', () => {
  it('渲染滑块', () => {
    const { container } = render(
      <Slider min={0} max={100} value={50} onChange={() => {}} />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('pointerdown 触发 onChange', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Slider min={0} max={100} value={50} onChange={onChange} />,
    );

    const track = container.firstChild as HTMLElement;
    // jsdom 中 getBoundingClientRect 返回零尺寸，但仍会触发 onChange
    fireEvent.pointerDown(track, { clientX: 50 });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('value=min 时填充宽度为 0%', () => {
    const { container } = render(
      <Slider min={0} max={100} value={0} onChange={() => {}} />,
    );
    // 填充轨道是第 2 个子元素
    const fill = container.firstChild!.childNodes[1] as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });

  it('value=max 时填充宽度为 100%', () => {
    const { container } = render(
      <Slider min={0} max={100} value={100} onChange={() => {}} />,
    );
    const fill = container.firstChild!.childNodes[1] as HTMLElement;
    expect(fill.style.width).toBe('100%');
  });
});

// ─── Badge ────────────────────────────────────────────

describe('Badge', () => {
  it('渲染 children 内容', () => {
    render(<Badge>3</Badge>);
    expect(screen.getByText('3')).toBeDefined();
  });

  it('primary variant 设置蓝色背景', () => {
    render(<Badge variant="primary">5</Badge>);
    const badge = screen.getByText('5');
    const styleAttr = badge.getAttribute('style') ?? '';
    // jsdom 将 #3B82F6 转为 rgb(59, 130, 246)
    expect(styleAttr).toContain('rgb(59, 130, 246)');
  });

  it('default variant 设置灰色背景', () => {
    render(<Badge variant="default">0</Badge>);
    const badge = screen.getByText('0');
    const styleAttr = badge.getAttribute('style') ?? '';
    expect(styleAttr).toContain('rgba');
  });

  it('渲染文本内容', () => {
    render(<Badge>新</Badge>);
    expect(screen.getByText('新')).toBeDefined();
  });

  it('支持自定义 style', () => {
    render(<Badge style={{ marginLeft: '4px' }}>2</Badge>);
    const badge = screen.getByText('2');
    expect(badge.style.marginLeft).toBe('4px');
  });
});
