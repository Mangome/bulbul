## MODIFIED Requirements

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
