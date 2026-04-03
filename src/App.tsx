import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ErrorBoundary } from './components/feedback/ErrorBoundary';
import { ToastContainer } from './components/feedback/ToastContainer';
import { initSettings } from './stores/initSettings';
import WelcomePage from './windows/WelcomePage';
import MainPage from './windows/MainPage';

function AppContent() {
  const [windowLabel, setWindowLabel] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [ready, setReady] = useState(false);

  // 初始化顺序：1. 加载设置 2. 获取窗口 label 3. 标记就绪 4. 显示窗口
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      // 第一步：加载持久化设置（主题、缩放等）
      try {
        await initSettings();
      } catch (err) {
        console.error('初始化设置失败:', err);
      }
      if (isMounted) {
        setSettingsLoaded(true);
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  // 第二步：获取窗口 label（只在设置加载完成后）
  useEffect(() => {
    if (settingsLoaded) {
      setWindowLabel(getCurrentWindow().label);
    }
  }, [settingsLoaded]);

  // 第三步：标记就绪
  useEffect(() => {
    if (windowLabel !== null) {
      // 等下一帧确保 DOM 已更新，再显示窗口
      requestAnimationFrame(() => {
        setReady(true);
      });
    }
  }, [windowLabel]);

  // 第四步：显示窗口（配合 visible: false）
  useEffect(() => {
    if (ready) {
      getCurrentWindow().show();
    }
  }, [ready]);

  if (windowLabel === null) {
    return null;
  }

  // 根据窗口 label 渲染对应页面
  switch (windowLabel) {
    case 'welcome':
      return <WelcomePage />;
    case 'main':
      return <MainPage />;
    default:
      return (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <h2 style={{ color: 'var(--color-danger)' }}>未知窗口</h2>
          <p>窗口 label: {windowLabel}</p>
        </div>
      );
  }
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
      <ToastContainer />
    </ErrorBoundary>
  );
}

export default App;
