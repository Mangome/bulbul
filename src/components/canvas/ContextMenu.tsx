import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import styles from './ContextMenu.module.css';

interface ContextMenuProps {
  x: number;
  y: number;
  hash: string;
  onClose: () => void;
}

export function ContextMenu({ x, y, hash, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleViewOriginal = async () => {
    onClose();
    try {
      await invoke('open_original', { hash });
    } catch (e) {
      console.error('[ContextMenu] 打开原图失败:', e);
    }
  };

  // 调整位置确保不超出视口
  const adjustedX = Math.min(x, window.innerWidth - 180);
  const adjustedY = Math.min(y, window.innerHeight - 50);

  return (
    <div
      ref={menuRef}
      className={styles.contextMenu}
      style={{ left: adjustedX, top: adjustedY }}
    >
      <button
        className={styles.contextMenuItem}
        onClick={handleViewOriginal}
      >
        查看原图
      </button>
    </div>
  );
}
