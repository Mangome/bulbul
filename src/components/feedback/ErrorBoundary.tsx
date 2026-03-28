import { Component, type ReactNode, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] 捕获到未处理的渲染错误:', error);
    console.error('[ErrorBoundary] 组件堆栈:', errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.icon}>!</div>
            <h2 style={styles.title}>出现了意外错误</h2>
            <p style={styles.message}>
              {this.state.error?.message || '应用遇到了未知错误'}
            </p>
            <button style={styles.retryBtn} onClick={this.handleRetry}>
              重试
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: 'var(--color-bg-primary)',
    padding: 32,
  },
  card: {
    textAlign: 'center',
    maxWidth: 400,
    padding: 32,
    borderRadius: 12,
    background: 'var(--color-bg-secondary)',
    border: '1px solid var(--color-border)',
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: 'var(--color-danger-light)',
    color: 'var(--color-danger)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 16,
  },
  title: {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    marginBottom: 8,
  },
  message: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.6,
    marginBottom: 24,
  },
  retryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 24px',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    color: '#FFFFFF',
    backgroundColor: 'var(--color-primary)',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
  },
};
