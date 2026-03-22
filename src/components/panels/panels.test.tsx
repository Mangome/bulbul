import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GroupListItem } from './GroupListItem';
import { useSelectionStore } from '../../stores/useSelectionStore';
import { useAppStore } from '../../stores/useAppStore';

describe('GroupListItem', () => {
  const defaultProps = {
    groupId: 1,
    name: '分组 1',
    imageCount: 10,
    avgSimilarity: 85,
    selectedCount: 0,
    thumbnailUrl: null,
    isActive: false,
    onClick: vi.fn(),
  };

  it('渲染分组名称和图片数量', () => {
    render(<GroupListItem {...defaultProps} />);
    expect(screen.getByText('分组 1')).toBeDefined();
    expect(screen.getByText('10 张')).toBeDefined();
  });

  it('渲染相似度百分比', () => {
    render(<GroupListItem {...defaultProps} />);
    expect(screen.getByText('85% 相似')).toBeDefined();
  });

  it('点击触发 onClick', () => {
    const onClick = vi.fn();
    render(<GroupListItem {...defaultProps} onClick={onClick} />);
    // 点击容器
    fireEvent.click(screen.getByText('分组 1').closest('div')!.parentElement!);
    expect(onClick).toHaveBeenCalledWith(1);
  });

  it('selectedCount > 0 时显示 Badge', () => {
    render(<GroupListItem {...defaultProps} selectedCount={3} />);
    expect(screen.getByText('3')).toBeDefined();
  });

  it('selectedCount = 0 时不显示 Badge', () => {
    render(<GroupListItem {...defaultProps} selectedCount={0} />);
    expect(screen.queryByText('0')).toBeNull();
  });

  it('空分组不过滤（由父组件过滤）', () => {
    render(<GroupListItem {...defaultProps} imageCount={0} />);
    expect(screen.getByText('0 张')).toBeDefined();
  });
});
