// ============================================================
// 键盘快捷键速查表 (ShortcutsDialog)
//
// 「?」键或「显示选项 → 键盘快捷键」触发的小型模态表。
// ============================================================

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DURATION, EASE } from '../../utils/motionTokens';
import cls from './ShortcutsDialog.module.css';

export interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: '← → / A D / W S', action: '上一组 / 下一组' },
  { keys: '空格', action: '选中 / 取消选中悬停图片' },
  { keys: 'Ctrl+A', action: '全选当前组' },
  { keys: 'Q / Esc', action: '清空选中' },
  { keys: '长按图片', action: '放大镜查看局部' },
  { keys: '右键', action: '图片菜单' },
  { keys: 'Ctrl+O', action: '打开文件夹' },
  { keys: 'Ctrl+E', action: '导出选中图片' },
  { keys: '?', action: '打开本表' },
];

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={cls.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.normal, ease: EASE.standard }}
        >
          <div className={cls.backdrop} onClick={onClose} />
          <motion.div
            className={cls.dialog}
            initial={{ opacity: 0, scale: 0.96, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.normal, ease: EASE.outQuint }}
            role="dialog"
            aria-label="键盘快捷键"
          >
            <div className={cls.title}>键盘快捷键</div>
            <div className={cls.list}>
              {SHORTCUTS.map((s) => (
                <div key={s.keys} className={cls.row}>
                  <kbd className={cls.kbd}>{s.keys}</kbd>
                  <span className={cls.action}>{s.action}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
