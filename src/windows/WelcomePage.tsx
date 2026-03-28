import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { selectFolder } from '../services/fileService';
import cls from './WelcomePage.module.css';

function WelcomePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectFolder = async () => {
    try {
      setLoading(true);
      setError(null);

      const folderPath = await selectFolder();
      if (!folderPath) {
        // 用户取消了选择
        setLoading(false);
        return;
      }

      // 打开主窗口，传入文件夹路径
      await invoke('open_main_window', { folderPath });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  return (
    <div className={cls.container}>
      <div className={cls.content}>
        <h1 className={cls.title}>Bulbul</h1>
        <p className={cls.subtitle}>RAW 图像筛选与管理工具</p>
        <p className={cls.description}>
          选择包含 NEF 文件的文件夹，开始智能分组和筛选您的照片。
        </p>

        <button
          className={`${cls.button} ${loading ? cls.buttonDisabled : ''}`}
          onClick={handleSelectFolder}
          disabled={loading}
        >
          {loading ? '正在打开...' : '选择文件夹'}
        </button>

        {error && <p className={cls.error}>{error}</p>}
      </div>
    </div>
  );
}

export default WelcomePage;
