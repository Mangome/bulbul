import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import WelcomePage from './windows/WelcomePage';
import MainPage from './windows/MainPage';

function App() {
  const [windowLabel, setWindowLabel] = useState<string | null>(null);

  useEffect(() => {
    const label = getCurrentWindow().label;
    setWindowLabel(label);
  }, []);

  // 加载中
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

export default App;
