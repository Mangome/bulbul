import { describe, it, expect, beforeEach } from 'vitest';
import { useToastStore } from './useToastStore';

describe('useToastStore', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it('初始状态应为空队列', () => {
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('addToast 应添加一条消息并返回 id', () => {
    const id = useToastStore.getState().addToast({ type: 'success', message: '操作成功' });
    expect(typeof id).toBe('string');

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].message).toBe('操作成功');
  });

  it('addToast 应为不同类型使用正确的默认 duration', () => {
    useToastStore.getState().addToast({ type: 'success', message: 'ok' });
    useToastStore.getState().addToast({ type: 'error', message: 'err' });
    useToastStore.getState().addToast({ type: 'info', message: 'info' });
    useToastStore.getState().addToast({ type: 'warning', message: 'warn' });

    const { toasts } = useToastStore.getState();
    // 最新的在前
    const warning = toasts.find((t) => t.type === 'warning');
    const success = toasts.find((t) => t.type === 'success');
    const error = toasts.find((t) => t.type === 'error');
    const info = toasts.find((t) => t.type === 'info');

    expect(success?.duration).toBe(3000);
    expect(info?.duration).toBe(3000);
    expect(error?.duration).toBe(5000);
    expect(warning?.duration).toBe(5000);
  });

  it('addToast 应支持自定义 duration', () => {
    useToastStore.getState().addToast({ type: 'success', message: 'ok', duration: 10000 });
    expect(useToastStore.getState().toasts[0].duration).toBe(10000);
  });

  it('addToast 应为每条消息分配唯一 id', () => {
    const id1 = useToastStore.getState().addToast({ type: 'info', message: 'a' });
    const id2 = useToastStore.getState().addToast({ type: 'info', message: 'b' });
    expect(id1).not.toBe(id2);
  });

  it('removeToast 应移除指定 id 的消息', () => {
    const id = useToastStore.getState().addToast({ type: 'success', message: 'ok' });
    useToastStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('removeToast 对不存在的 id 不应报错', () => {
    useToastStore.getState().addToast({ type: 'success', message: 'ok' });
    useToastStore.getState().removeToast('nonexistent');
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('队列上限为 5 条，超出时移除最早的', () => {
    for (let i = 0; i < 7; i++) {
      useToastStore.getState().addToast({ type: 'info', message: `msg-${i}` });
    }

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(5);
    // 最新的在最前
    expect(toasts[0].message).toBe('msg-6');
  });

  it('新消息应出现在队列最前面', () => {
    useToastStore.getState().addToast({ type: 'info', message: 'first' });
    useToastStore.getState().addToast({ type: 'info', message: 'second' });

    const { toasts } = useToastStore.getState();
    expect(toasts[0].message).toBe('second');
    expect(toasts[1].message).toBe('first');
  });
});
