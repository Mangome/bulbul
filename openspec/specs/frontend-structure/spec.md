## ADDED Requirements

### Requirement: 前端目录结构
系统 SHALL 在 `src/` 下建立以下目录：`windows/`（窗口级页面）、`components/`（UI 组件，含 canvas/、panels/、dialogs/、common/ 子目录）、`stores/`（Zustand 状态）、`hooks/`（自定义 Hooks）、`services/`（IPC 服务封装）、`types/`（TypeScript 类型）、`styles/`（样式）、`utils/`（工具函数）。

#### Scenario: 所有目录存在
- **WHEN** 查看 `src/` 目录结构
- **THEN** SHALL 存在 windows/、components/、stores/、hooks/、services/、types/、styles/、utils/ 八个顶级目录

### Requirement: WelcomePage 页面组件
系统 SHALL 提供 `windows/WelcomePage.tsx` 组件，包含应用标题（Bulbul）、简介文字、「选择文件夹」按钮。点击按钮 SHALL 调用 fileService.selectFolder()，选择成功后调用 `open_main_window` 命令切换到主窗口。

#### Scenario: 欢迎页渲染
- **WHEN** WelcomePage 组件挂载
- **THEN** SHALL 显示应用标题 "Bulbul" 和 "选择文件夹" 按钮

#### Scenario: 选择文件夹并切换窗口
- **WHEN** 用户点击 "选择文件夹" 按钮并选择了一个文件夹
- **THEN** SHALL 调用 open_main_window 命令，传入文件夹路径

### Requirement: MainPage 占位页面组件
系统 SHALL 提供 `windows/MainPage.tsx` 组件作为主窗口页面占位，后续阶段将在此集成 PixiJS 画布。当前阶段 SHALL 显示文件夹路径和基本信息。

#### Scenario: 主页面渲染
- **WHEN** MainPage 组件挂载
- **THEN** SHALL 渲染一个占位页面，显示 "Bulbul 主工作区" 标题

### Requirement: App.tsx 窗口路由
`App.tsx` SHALL 根据当前 Tauri 窗口 label 渲染对应的页面组件。在组件初始化时获取窗口 label，基于 label 值选择渲染 WelcomePage 或 MainPage。

#### Scenario: 正确路由到对应窗口
- **WHEN** App 组件在 label 为 `welcome` 的窗口中加载
- **THEN** SHALL 渲染 WelcomePage 组件

### Requirement: CSS 变量系统
系统 SHALL 在 `styles/variables.css` 中定义 CSS 变量，包括主色调（--color-primary: #3B82F6）、成功色（--color-success: #10B981）、警告色（--color-warning: #F59E0B）、危险色（--color-danger: #EF4444）、选中态颜色、面板样式变量。在 `styles/global.css` 中定义全局重置样式。

#### Scenario: CSS 变量可用
- **WHEN** 任意组件使用 `var(--color-primary)`
- **THEN** SHALL 解析为 `#3B82F6`

### Requirement: 全局样式
`styles/global.css` SHALL 导入 `variables.css`，定义 box-sizing 重置（border-box）、body margin 为 0、font-family 设为系统字体栈、基础滚动条样式。

#### Scenario: 全局样式生效
- **WHEN** 应用加载
- **THEN** body margin SHALL 为 0，所有元素 box-sizing SHALL 为 border-box
