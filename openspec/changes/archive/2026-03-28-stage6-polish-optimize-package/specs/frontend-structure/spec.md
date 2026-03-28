## MODIFIED Requirements

### Requirement: 前端目录结构

系统 SHALL 在 `src/` 下建立以下目录：`windows/`（窗口级页面）、`components/`（UI 组件，含 canvas/、panels/、dialogs/、common/、feedback/ 子目录）、`stores/`（Zustand 状态）、`hooks/`（自定义 Hooks）、`services/`（IPC 服务封装）、`types/`（TypeScript 类型）、`styles/`（样式）、`utils/`（工具函数）。

#### Scenario: 所有目录存在

- **WHEN** 查看 `src/` 目录结构
- **THEN** SHALL 存在 windows/、components/、stores/、hooks/、services/、types/、styles/、utils/ 八个顶级目录

#### Scenario: feedback 子目录存在

- **WHEN** 查看 `src/components/` 目录结构
- **THEN** SHALL 存在 canvas/、panels/、dialogs/、common/、feedback/ 五个子目录

### Requirement: CSS Module 样式方案

所有 React DOM 组件 SHALL 使用 CSS Module（`.module.css`）文件管理样式，替代内联 `styles` 对象。CSS Module 文件 SHALL 与组件文件同目录放置。

#### Scenario: 组件样式文件命名

- **WHEN** 查看组件目录
- **THEN** 每个组件 `Xxx.tsx` SHALL 有对应的 `Xxx.module.css` 文件

#### Scenario: 样式导入方式

- **WHEN** 组件需要引用样式
- **THEN** SHALL 使用 `import styles from './Xxx.module.css'` 导入，类名通过 `styles.className` 引用

### Requirement: WelcomePage 页面组件

系统 SHALL 提供 `windows/WelcomePage.tsx` 组件，包含应用标题（Bulbul）、简介文字、「选择文件夹」按钮。点击按钮 SHALL 调用 fileService.selectFolder()，选择成功后调用 `open_main_window` 命令切换到主窗口。样式 SHALL 使用 CSS Module 实现。

#### Scenario: 欢迎页渲染

- **WHEN** WelcomePage 组件挂载
- **THEN** SHALL 显示应用标题 "Bulbul" 和 "选择文件夹" 按钮

#### Scenario: 选择文件夹并切换窗口

- **WHEN** 用户点击 "选择文件夹" 按钮并选择了一个文件夹
- **THEN** SHALL 调用 open_main_window 命令，传入文件夹路径

### Requirement: MainPage 占位页面组件

系统 SHALL 提供 `windows/MainPage.tsx` 组件作为主窗口页面，集成 PixiJS 画布、悬浮面板、控制栏、进度对话框。样式 SHALL 使用 CSS Module 实现。错误提示 SHALL 通过 Toast 通知展示，替代 `alert()`。

#### Scenario: 主页面渲染

- **WHEN** MainPage 组件挂载
- **THEN** SHALL 渲染主工作区，包含画布容器和悬浮 UI 层

#### Scenario: 导出结果 Toast 通知

- **WHEN** 导出操作完成
- **THEN** SHALL 通过 Toast 组件展示结果信息，而非 `alert()`

#### Scenario: 错误 Toast 通知

- **WHEN** IPC 调用或处理过程中发生错误
- **THEN** SHALL 通过 error 类型 Toast 展示错误信息

### Requirement: App.tsx 窗口路由

`App.tsx` SHALL 根据当前 Tauri 窗口 label 渲染对应的页面组件。SHALL 在最外层包裹 ErrorBoundary 和 ToastContainer。

#### Scenario: 正确路由到对应窗口

- **WHEN** App 组件在 label 为 `welcome` 的窗口中加载
- **THEN** SHALL 渲染 WelcomePage 组件

#### Scenario: ErrorBoundary 和 ToastContainer 包裹

- **WHEN** App 组件渲染
- **THEN** SHALL 在组件树外层包含 ErrorBoundary 和 ToastContainer

### Requirement: CSS 变量系统

系统 SHALL 在 `styles/variables.css` 中定义 CSS 变量，包括亮色主题（`:root`）和暗色主题（`[data-theme="dark"]`）两套完整变量集。涵盖主色调、语义色、中性色、面板样式、间距、字体等。

#### Scenario: CSS 变量可用

- **WHEN** 任意组件使用 `var(--color-primary)`
- **THEN** SHALL 解析为当前主题对应的颜色值

### Requirement: 全局样式

`styles/global.css` SHALL 导入 `variables.css`，定义 box-sizing 重置（border-box）、body margin 为 0、font-family 设为系统字体栈、基础滚动条样式。

#### Scenario: 全局样式生效

- **WHEN** 应用加载
- **THEN** body margin SHALL 为 0，所有元素 box-sizing SHALL 为 border-box
