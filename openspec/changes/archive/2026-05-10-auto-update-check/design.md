## Context

Bulbul 是 Tauri 2 桌面应用，已有完整的更新检查基础设施：`updaterService.ts` 封装了 Tauri updater plugin，`SettingsPanel` 中有手动检查更新 UI。但当前仅在用户主动点击"检查更新"时触发，大多数用户不会主动检查，可能长期使用旧版本。

现有组件：
- `updaterService.ts`：提供 `checkForUpdate()`、`downloadAndInstallUpdate()` 方法
- `useToastStore`：Zustand store，管理 toast 队列，当前无 onClick 支持
- `Toast.tsx`：仅支持展示和自动消失，不支持点击交互
- `MainPage.tsx`：主窗口页面，已有 `showSettings` 状态管理设置面板开关

## Goals / Non-Goals

**Goals:**
- 应用启动时在主窗口静默检查一次更新，不阻塞 UI
- 发现新版本时通过可点击 toast 通知用户，点击后打开设置面板
- 检查失败或已是最新版本时完全静默，无任何 UI 反馈

**Non-Goals:**
- 不实现"跳过此版本"功能
- 不在欢迎窗口（welcome）执行检查
- 不自动下载或安装更新
- 不添加更新检查频率配置

## Decisions

### 1. 使用自定义 Hook 而非全局初始化

**选择**：在 `MainPage.tsx` 中通过 `useAutoUpdateCheck(onOpenSettings)` hook 触发

**理由**：
- 仅主窗口需要检查，welcome 窗口不需要
- Hook 可访问组件状态（打开设置面板的回调），无需跨组件通信
- 符合 React 惯用模式，易于测试和复用

**备选方案**：
- 在 `App.tsx` 的 `initSettings` 中触发：需要区分窗口类型，且无法直接打开设置面板
- 在 Rust 端触发检查并通过事件通知前端：增加 IPC 复杂度，且已有前端 updaterService

### 2. Toast 新增 onClick 回调

**选择**：在 `useToastStore` 的 ToastItem 中新增 `onClick?: () => void` 字段

**理由**：
- 最小改动，仅新增一个可选字段
- Toast 组件已有点击关闭按钮，扩展为整体可点击改动小
- 点击后自动关闭 toast 再执行回调，用户体验自然

**备选方案**：
- 在 toast 消息中嵌入链接：实现复杂，toast 内容为纯文本
- 使用独立的通知组件：增加新组件，过度设计

### 3. 使用 ref 防止 StrictMode 双重触发

**选择**：在 hook 内部使用 `useRef(false)` 保证检查逻辑只执行一次

**理由**：React 18 StrictMode 在开发模式下会双重调用 effect，需防止重复请求。与 `MainPage.tsx` 中已有的 `initCalledRef` 模式一致。

## Risks / Trade-offs

- [启动时网络请求可能延迟] → 检查完全异步，不阻塞 UI，失败静默忽略
- [Toast onClick 可能与自动消失计时器冲突] → 点击后立即关闭 toast，无冲突
- [自动检查可能在离线环境产生无意义的网络请求] → 失败完全静默，用户无感知
