import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toast } from './Toast';
import type { ToastItem } from '../../stores/useToastStore';

vi.mock('../../stores/useToastStore', () => ({
  useToastStore: vi.fn(),
}));

import { useToastStore } from '../../stores/useToastStore';

const mockRemoveToast = vi.fn();
vi.mocked(useToastStore).mockImplementation((selector: never) => {
  const state = { removeToast: mockRemoveToast };
  return selector(state);
});

function createToast(overrides?: Partial<ToastItem>): ToastItem {
  return {
    id: '1',
    type: 'info',
    message: 'Test message',
    duration: 5000,
    ...overrides,
  };
}

describe('Toast onClick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call onClick and remove toast when clicked', () => {
    const onClick = vi.fn();
    const toast = createToast({ onClick });

    render(<Toast toast={toast} />);

    const toastEl = screen.getByRole('status');
    fireEvent.click(toastEl);

    expect(mockRemoveToast).toHaveBeenCalledWith('1');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should not have clickable style when onClick is absent', () => {
    const toast = createToast();

    render(<Toast toast={toast} />);

    const toastEl = screen.getByRole('status');
    expect(toastEl.className).not.toContain('clickable');
  });

  it('should have clickable style when onClick is provided', () => {
    const onClick = vi.fn();
    const toast = createToast({ onClick });

    render(<Toast toast={toast} />);

    const toastEl = screen.getByRole('status');
    expect(toastEl.className).toContain('clickable');
  });

  it('should not trigger click handler when onClick is absent', () => {
    const toast = createToast();

    render(<Toast toast={toast} />);

    const toastEl = screen.getByRole('status');
    fireEvent.click(toastEl);

    // removeToast should NOT be called via the div click
    expect(mockRemoveToast).not.toHaveBeenCalled();
  });
});
