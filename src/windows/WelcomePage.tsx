import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { selectFolder } from '../services/fileService';
import appIcon from '../assets/app-icon.png';
import cls from './WelcomePage.module.css';

function WelcomePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState('');

  useEffect(() => {
    getVersion().then(setVersion);
  }, []);

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
        <img src={appIcon} alt="Bulbul" className={cls.icon} draggable={false} />
        <h1 className={cls.title}>Bulbul</h1>
        <p className={cls.subtitle}>RAW 图像快速筛选</p>
        {version && <p className={cls.version}>v{version}</p>}
        <p className={cls.description}>
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
