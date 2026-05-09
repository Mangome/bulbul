import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { selectFolder } from '../services/fileService';
import appIcon from '../assets/app-icon.png';
import cls from './WelcomePage.module.css';

function drawLogoWithEdgeExtension(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  canvas.width = w * dpr;
  canvas.height = h * dpr;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // Contain 计算
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const canvasRatio = w / h;

  let dw: number, dh: number, dx: number, dy: number;

  if (imgRatio > canvasRatio) {
    dw = w;
    dh = w / imgRatio;
    dx = 0;
    dy = (h - dh) / 2;
  } else {
    dh = h;
    dw = h * imgRatio;
    dx = (w - dw) / 2;
    dy = 0;
  }

  // 居中绘制 Logo
  ctx.drawImage(img, dx, dy, dw, dh);

  // 从已渲染的 Canvas 读取边缘像素，拉伸填满空白区域
  const stretchStrip = (
    srcX: number, srcY: number, srcW: number, srcH: number,
    destX: number, destY: number, destW: number, destH: number,
  ) => {
    const px = Math.round(srcX * dpr);
    const py = Math.round(srcY * dpr);
    const pw = Math.max(1, Math.round(srcW * dpr));
    const ph = Math.max(1, Math.round(srcH * dpr));

    const off = document.createElement('canvas');
    off.width = pw;
    off.height = ph;
    off.getContext('2d')!.drawImage(canvas, px, py, pw, ph, 0, 0, pw, ph);
    ctx.drawImage(off, destX, destY, destW, destH);
  };

  // 左侧延展
  if (dx > 0) {
    stretchStrip(dx, dy, 1, dh, 0, dy, dx, dh);
  }

  // 右侧延展
  const rightGap = w - dx - dw;
  if (rightGap > 0) {
    stretchStrip(dx + dw - 1, dy, 1, dh, dx + dw, dy, rightGap, dh);
  }

  // 顶部延展
  if (dy > 0) {
    stretchStrip(dx, dy, dw, 1, dx, 0, dw, dy);
  }

  // 底部延展
  const bottomGap = h - dy - dh;
  if (bottomGap > 0) {
    stretchStrip(dx, dy + dh - 1, dw, 1, dx, dy + dh, dw, bottomGap);
  }
}

function WelcomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState('');

  useEffect(() => {
    getVersion().then(setVersion);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.src = appIcon;
    img.onload = () => drawLogoWithEdgeExtension(canvas, img);
  }, []);

  const handleClose = () => {
    getCurrentWindow().close();
  };

  const handleSelectFolder = async () => {
    try {
      setLoading(true);
      setError(null);

      const folderPath = await selectFolder();
      if (!folderPath) {
        setLoading(false);
        return;
      }

      await invoke('open_main_window', { folderPath });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  return (
    <div className={cls.window}>
      {/* Logo 画布 - contain 居中 + 边缘像素延展填充空白 */}
      <canvas ref={canvasRef} className={cls.logoCanvas} />

      {/* 拖拽区域 - 覆盖上半部分 */}
      <div className={cls.dragRegion} data-tauri-drag-region />

      {/* 关闭按钮 */}
      <button
        className={cls.closeBtn}
        onClick={handleClose}
        aria-label="关闭"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M1 1L9 9M9 1L1 9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* 主交互区 */}
      <div className={cls.actions}>
        <span className={cls.appName}>Bulbul</span>
        <button
          className={`${cls.openBtn} ${loading ? cls.openBtnDisabled : ''}`}
          onClick={handleSelectFolder}
          disabled={loading}
          aria-busy={loading}
          aria-label="选择图片文件夹以开始筛选"
        >
          <span className={cls.openBtnLabel}>
            {loading ? '正在打开…' : '选择文件夹'}
          </span>
          {!loading && (
            <svg
              className={cls.openBtnArrow}
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 7h8m0 0L7.5 3.5M11 7L7.5 10.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <p className={cls.error} role="alert">
          {error}
        </p>
      )}

      {/* 版本号水印 */}
      {version && (
        <span className={cls.version} aria-hidden="true">
          v{version}
        </span>
      )}
    </div>
  );
}

export default WelcomePage;
