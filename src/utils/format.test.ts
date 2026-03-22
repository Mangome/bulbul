import { describe, it, expect } from 'vitest';
import { formatDuration } from './format';

describe('formatDuration', () => {
  it('should format 0ms as 0:00', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('should format 5000ms as 0:05', () => {
    expect(formatDuration(5000)).toBe('0:05');
  });

  it('should format 60000ms as 1:00', () => {
    expect(formatDuration(60000)).toBe('1:00');
  });

  it('should format 125000ms as 2:05', () => {
    expect(formatDuration(125000)).toBe('2:05');
  });

  it('should format 3661000ms as 61:01', () => {
    expect(formatDuration(3661000)).toBe('61:01');
  });

  it('should pad seconds with leading zero', () => {
    expect(formatDuration(3000)).toBe('0:03');
    expect(formatDuration(63000)).toBe('1:03');
  });

  it('should floor fractional milliseconds', () => {
    expect(formatDuration(1500)).toBe('0:01');
    expect(formatDuration(999)).toBe('0:00');
  });
});
