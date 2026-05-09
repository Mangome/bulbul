## Why

当前更新检查仅在用户手动打开设置面板点击"检查更新"时触发，大多数用户不会主动检查，可能长期使用旧版本。应用启动时自动检查一次新版本，可让用户及时发现并安装更新。

## What Changes

- 新增启动时自动静默检查更新逻辑，仅在主窗口（main）执行
- 检测到新版本时通过 toast 通知用户，点击 toast 可打开设置面板查看详情
- Toast 组件新增可选的 onClick 回调支持，使 toast 可点击

## Capabilities

### New Capabilities
- `auto-update-check`: 启动时静默检查更新并通过可点击 toast 通知用户

### Modified Capabilities
- `toast-notification`: 新增 onClick 回调支持，使 toast 可点击交互
- `desktop-updater`: 新增启动时自动检查场景（仅检查，不自动安装）

## Impact

- 前端新增 `src/hooks/useAutoUpdateCheck.ts` hook
- `src/stores/useToastStore.ts` 的 ToastItem 类型新增 onClick 字段
- `src/components/feedback/Toast.tsx` 支持点击交互
- `src/windows/MainPage.tsx` 集成自动更新检查 hook
- 网络请求：启动时访问 GitHub Releases endpoint 一次（静默，失败无感知）
