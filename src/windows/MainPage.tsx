function MainPage() {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Bulbul 主工作区</h1>
        <p style={styles.subtitle}>画布和面板将在后续阶段集成</p>
      </div>
      <div style={styles.placeholder}>
        <p style={styles.placeholderText}>
          🖼️ PixiJS 画布区域（Stage 4 实现）
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: 'var(--color-bg-primary)',
  },
  header: {
    padding: 'var(--spacing-md) var(--spacing-lg)',
    borderBottom: '1px solid var(--color-border)',
  },
  title: {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  subtitle: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-muted)',
    margin: '4px 0 0',
  },
  placeholder: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-bg-secondary)',
  },
  placeholderText: {
    fontSize: 'var(--font-size-lg)',
    color: 'var(--color-text-muted)',
  },
};

export default MainPage;
