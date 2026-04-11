## ADDED Requirements

### Requirement: CSS 变量双主题体系

系统 SHALL 在 `styles/variables.css` 中定义两套完整的 CSS 变量：`:root`（亮色主题）和 `[data-theme="dark"]`（暗色主题）。暗色主题 SHALL 覆盖所有语义色、背景色、文字色、边框色、面板样式变量。

#### Scenario: 亮色主题变量

- **WHEN** `<html>` 元素无 `data-theme` 属性或 `data-theme="light"`
- **THEN** CSS 变量 SHALL 使用亮色色板（如 `--color-bg-primary: #FFFFFF`、`--color-text-primary: #1F2937`）

#### Scenario: 暗色主题变量

- **WHEN** `<html>` 元素 `data-theme="dark"`
- **THEN** CSS 变量 SHALL 切换为暗色色板（如 `--color-bg-primary: #1A1A2E`、`--color-text-primary: #E2E8F0`），所有使用 CSS 变量的组件自动适配暗色

#### Scenario: 面板样式暗色适配

- **WHEN** 暗色主题激活
- **THEN** `--panel-bg` SHALL 切换为半透明深色（如 `rgba(30, 30, 50, 0.94)`），`--panel-border` 和 `--panel-shadow` 相应调整

### Requirement: useThemeStore 主题状态管理

系统 SHALL 提供 `stores/useThemeStore.ts` Zustand Store，管理当前主题状态并同步到 DOM。

#### Scenario: 初始主题

- **WHEN** 应用启动
- **THEN** 主题 SHALL 默认为 `"light"`

#### Scenario: 切换主题

- **WHEN** 调用 `toggleTheme()` action
- **THEN** 主题在 `"light"` 和 `"dark"` 之间切换，`document.documentElement` 的 `data-theme` 属性同步更新

#### Scenario: 获取当前主题

- **WHEN** 组件订阅 `useThemeStore` 的 `theme` 状态
- **THEN** SHALL 获取当前主题值（`"light"` 或 `"dark"`）

### Requirement: Canvas 背景与波点颜色应用主题

主题系统已在 Phase 6 中完成 CSS 变量体系，Phase 5 需要在 Canvas 绘制中应用主题（背景色、波点色）。

#### Scenario: 亮色主题绘制

- **WHEN** useThemeStore.theme === 'light'
- **THEN** Canvas 背景色设置为 #FFFFFF
- **AND** DotBackground.updateTheme('light') 更新波点颜色为 #E0E4EB

#### Scenario: 暗色主题绘制

- **WHEN** useThemeStore.theme === 'dark'
- **THEN** Canvas 背景色设置为 #0A0E1A
- **AND** DotBackground.updateTheme('dark') 更新波点颜色为 #232D40

#### Scenario: 主题切换时重新渲染

- **WHEN** useThemeStore.toggleTheme() 被调用
- **THEN** DotBackground 更新 pattern
- **AND** markDirty() 触发重新渲染
- **AND** 下一帧应用新主题颜色
