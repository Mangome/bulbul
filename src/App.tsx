import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ErrorBoundary } from './components/feedback/ErrorBoundary';
import { ToastContainer } from './components/feedback/ToastContainer';
import WelcomePage from './windows/WelcomePage';
import MainPage from './windows/MainPage';

function AppContent() {
  const [windowLabel, setWindowLabel] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setWindowLabel(getCurrentWindow().label);
  }, []);

  // 页面组件挂载后，标记为就绪
  useEffect(() => {
    if (windowLabel !== null) {
      // 等下一帧确保 DOM 已更新，再显示窗口
      requestAnimationFrame(() => {
        setReady(true);
      });
    }
  }, [windowLabel]);

  // ready 后显示窗口（配合 visible: false）
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
