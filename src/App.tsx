import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ErrorBoundary } from './components/feedback/ErrorBoundary';
import { ToastContainer } from './components/feedback/ToastContainer';
import { initSettings } from './stores/initSettings';
import WelcomePage from './windows/WelcomePage';
import MainPage from './windows/MainPage';

function AppContent() {
  const [windowLabel, setWindowLabel] = useState<string | null>(null);

  // 初始化设置并获取窗口 label（窗口显示由 Rust on_page_load 控制）
  useEffect(() => {
    const init = async () => {
      const [, label] = await Promise.all([
        initSettings().catch(err => console.error('初始化设置失败:', err)),
        Promise.resolve(getCurrentWindow().label),
      ]);
      setWindowLabel(label);
    };
    init();
  }, []);

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
