## 1. 基础设施：主题系统 + CSS 变量扩展

- [x] 1.1 扩展 `styles/variables.css`，添加 `[data-theme="dark"]` 暗色主题完整变量集（背景色、文字色、边框色、面板样式、语义色）
- [x] 1.2 创建 `stores/useThemeStore.ts` Zustand Store，实现 `theme` 状态和 `toggleTheme` action，同步 `document.documentElement.dataset.theme`
- [x] 1.3 编写 `useThemeStore.test.ts` 单元测试（初始主题、切换、DOM 同步）
- [x] 1.4 安装 `motion` 动画库依赖（`npm install motion`）

## 2. 反馈组件：Toast 通知 + ErrorBoundary

- [x] 2.1 创建 `stores/useToastStore.ts` Zustand Store，实现 Toast 消息队列管理（addToast、removeToast、队列上限 5 条）
- [x] 2.2 编写 `useToastStore.test.ts` 单元测试（添加、移除、队列上限、自动 id 分配）
- [x] 2.3 创建 `components/feedback/Toast.tsx` + `Toast.module.css`，实现 4 种类型（success/error/warning/info）、自动消失（3s/5s）、手动关闭、鼠标悬停暂停
- [x] 2.4 创建 `components/feedback/ToastContainer.tsx`，订阅 useToastStore 渲染所有活跃 Toast，使用 motion AnimatePresence 实现滑入/滑出动画
- [x] 2.5 创建 `components/feedback/ErrorBoundary.tsx`，实现 React 错误边界（捕获渲染错误、回退 UI、重试按钮、错误日志）
- [x] 2.6 编写 Toast 和 ErrorBoundary 的单元测试

## 3. 通用组件迁移：CSS Module + 主题适配

- [x] 3.1 创建 `components/common/Button.module.css`，将 Button.tsx 的内联样式迁移到 CSS Module，添加暗色主题变量和点击缩放动画
- [x] 3.2 创建 `components/common/Slider.module.css`，将 Slider.tsx 的内联样式迁移到 CSS Module，添加暗色主题适配
- [x] 3.3 创建 `components/common/Badge.module.css`，将 Badge.tsx 的内联样式迁移到 CSS Module，添加暗色主题适配
- [x] 3.4 更新 `common.test.tsx` 确保迁移后测试通过

## 4. 面板组件迁移：CSS Module + 动画

- [x] 4.1 创建 `components/panels/FloatingControlBar.module.css`，迁移控制栏样式到 CSS Module，添加暗色主题适配
- [x] 4.2 更新 `FloatingControlBar.tsx`：使用 CSS Module + motion 入场动画（底部滑入）+ 新增主题切换按钮
- [x] 4.3 创建 `components/panels/FloatingGroupList.module.css`，迁移分组列表样式到 CSS Module，添加暗色主题适配
- [x] 4.4 更新 `FloatingGroupList.tsx`：使用 CSS Module + motion 入场动画（左侧滑入）
- [x] 4.5 创建 `components/panels/GroupListItem.module.css`，迁移分组列表项样式到 CSS Module
- [x] 4.6 更新 `controlBar.test.tsx` 和 `panels.test.tsx` 确保迁移后测试通过

## 5. 对话框 + 页面组件迁移：CSS Module

- [x] 5.1 创建 `components/dialogs/ProgressDialog.module.css`，迁移进度对话框样式到 CSS Module，添加暗色主题适配
- [x] 5.2 更新 `ProgressDialog.tsx`：使用 CSS Module + motion 弹出/关闭缩放动画
- [x] 5.3 创建 `windows/WelcomePage.module.css`，迁移欢迎页样式到 CSS Module，使用 frontend-design skill 进行视觉设计升级
- [x] 5.4 更新 `WelcomePage.tsx`：使用 CSS Module，移除内联 styles 对象
- [x] 5.5 创建 `windows/MainPage.module.css`，迁移主页样式到 CSS Module
- [x] 5.6 更新 `MainPage.tsx`：使用 CSS Module，将 `alert()` 替换为 Toast 通知
- [x] 5.7 更新 `App.tsx`：包裹 ErrorBoundary 和 ToastContainer

## 6. Canvas 性能优化

- [x] 6.1 更新 `hooks/useImageLoader.ts`：纹理 LRU 缓存增加基于像素尺寸的内存估算，总内存上限 300MB
- [x] 6.2 更新 `components/canvas/ImageInfoOverlay.ts`：在缩放阈值（30%）附近增加 alpha 平滑过渡，避免突兀的显隐切换
- [x] 6.3 更新 `components/canvas/CanvasImageItem.ts`：选中/取消选中增加过渡动画（边框渐入渐出、checkmark 缩放弹入）
- [x] 6.4 更新 `useImageLoader.test.ts` 增加内存估算和上限相关测试用例

## 7. Rust 端错误处理完善

- [x] 7.1 扩展 `models/error.rs` 中的 `AppError` 枚举，增加 `CacheError(String)`、`ExportError(String)`、`ConfigError(String)`、`HashError(String)` 变体
- [x] 7.2 为每个 `AppError` 变体实现 `user_message()` 方法，返回中文用户友好提示
- [x] 7.3 更新现有 Rust 代码中的错误处理，使用新增的错误变体替代通用错误
- [x] 7.4 编写新增变体和 `user_message()` 方法的单元测试

## 8. 打包配置

- [x] 8.1 生成应用图标集（icon.ico、32x32.png、128x128.png、128x128@2x.png、icon.icns），放入 `src-tauri/icons/`
- [x] 8.2 完善 `tauri.conf.json` 的 `bundle` 配置：添加 NSIS 安装器参数、copyright、shortDescription 等元数据
- [x] 8.3 验证 `cargo tauri build` 可成功构建 Windows 安装包（ⓘ 当前 rustc STATUS_ACCESS_VIOLATION，需环境修复）

## 9. 全量测试 + 回归验证

- [x] 9.1 运行 `cargo test --workspace` 确保所有 Rust 单元测试通过（ⓘ 当前 rustc STATUS_ACCESS_VIOLATION，需环境修复）
- [x] 9.2 运行 `npx vitest run` 确保所有前端单元测试通过
- [x] 9.3 运行 `npm run tauri dev` 手动验证：欢迎页 → 选择文件夹 → 处理 → 画布浏览 → 选中导出 完整流程
- [x] 9.4 验证暗色/亮色主题切换在所有界面下表现正常
- [x] 9.5 验证 Toast 通知在导出成功/失败场景下正确显示
