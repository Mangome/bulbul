## ADDED Requirements

### Requirement: Welcome 窗口静态配置
系统 SHALL 在 `tauri.conf.json` 中配置 Welcome 窗口，label 为 `welcome`，标题为 `Bulbul`，尺寸 600×450，不可调整大小（resizable: false），居中显示（center: true），有窗口装饰（decorations: true）。

#### Scenario: 应用启动显示 Welcome 窗口
- **WHEN** 执行 `npm run tauri dev`
- **THEN** 应用启动后显示 600×450 的 Welcome 窗口，居中于屏幕

### Requirement: MainWindow 动态创建
系统 SHALL 提供 `open_main_window` IPC 命令，通过 `WebviewWindowBuilder` 动态创建 Main 窗口（label: `main`，尺寸 1200×900），创建后关闭 Welcome 窗口。

#### Scenario: 选择文件夹后切换窗口
- **WHEN** 用户在 Welcome 窗口选择文件夹后调用 `open_main_window`
- **THEN** 系统创建 1200×900 的 Main 窗口并关闭 Welcome 窗口

#### Scenario: Main 窗口已存在时重用
- **WHEN** 调用 `open_main_window` 但 label 为 `main` 的窗口已存在
- **THEN** SHALL 聚焦已有的 Main 窗口而非创建新窗口

### Requirement: 窗口 label 驱动前端渲染
前端 SHALL 在 `App.tsx` 中根据当前 Tauri 窗口 label 决定渲染的页面组件。label 为 `welcome` 时渲染 WelcomePage，label 为 `main` 时渲染 MainPage。

#### Scenario: Welcome 窗口渲染正确页面
- **WHEN** 在 label 为 `welcome` 的窗口中加载前端
- **THEN** 渲染 WelcomePage 组件

#### Scenario: Main 窗口渲染正确页面
- **WHEN** 在 label 为 `main` 的窗口中加载前端
- **THEN** 渲染 MainPage 组件

#### Scenario: 未知窗口 label
- **WHEN** 窗口 label 既不是 `welcome` 也不是 `main`
- **THEN** SHALL 渲染错误提示页面
