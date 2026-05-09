## 1. Toast 点击交互支持

- [x] 1.1 在 `src/stores/useToastStore.ts` 的 ToastItem 接口中新增 `onClick?: () => void` 可选字段
- [x] 1.2 在 `src/components/feedback/Toast.tsx` 中支持 onClick：有 onClick 时容器添加 cursor:pointer 样式和点击事件，点击后关闭 toast 并执行回调

## 2. 自动更新检查 Hook

- [x] 2.1 新建 `src/hooks/useAutoUpdateCheck.ts`：接收 `onOpenSettings` 回调，使用 ref 防止 StrictMode 双重触发，调用 `checkForUpdate()` 静默检查，发现新版本时通过 `useToastStore.addToast()` 弹出 info toast（含 onClick 回调打开设置面板），失败静默忽略

## 3. 集成到主窗口

- [x] 3.1 在 `src/windows/MainPage.tsx` 中引入 `useAutoUpdateCheck` hook，传入 `() => setShowSettings(true)` 回调

## 4. 测试

- [x] 4.1 为 `useAutoUpdateCheck` 编写单元测试，覆盖：检查到新版本时弹出 toast、无新版本时静默、检查失败时静默、StrictMode 防重复
- [x] 4.2 为 Toast onClick 交互编写单元测试，覆盖：点击触发回调、无 onClick 时默认行为
