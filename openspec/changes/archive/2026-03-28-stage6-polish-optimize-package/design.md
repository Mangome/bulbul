## Context

Bulbul 是一个基于 Tauri + React + PixiJS 的 RAW 图像筛选工具，已完成 Stage 1~5 的全部 MVP 功能。当前前端 UI 使用内联 `styles` 对象编写样式，仅有亮色主题，无动画过渡，错误处理通过 `alert()` 展示，打包配置为脚手架默认值。Stage 6 需要将其提升至可发布品质。

**当前技术栈**：React 18 + Zustand 5 + PixiJS 8 + Vite 6 + TypeScript 5 + Tauri 2

**约束**：
- 改动不得引入功能回归，需全量通过 `cargo test` + `vitest`
- 前端代码量增量约 ~1000 行，Rust 约 ~300 行，配置约 ~200 行
- 不引入重量级 UI 框架（无 Ant Design / MUI 等）

## Goals / Non-Goals

**Goals:**
- 建立 CSS Module + CSS 变量的主题系统，支持亮色/暗色切换
- 所有组件从内联样式迁移到 CSS Module，提升可维护性
- 用 motion 库为关键交互添加流畅动画
- 用 Toast 组件替代 `alert()` 提供专业的反馈体验
- 完善 Rust 端错误类型，前端增加 ErrorBoundary 兜底
- 优化纹理内存占用和渲染性能
- 配置 Tauri 生产打包，生成 Windows 安装包

**Non-Goals:**
- 不做国际化（i18n）
- 不添加用户偏好持久化（主题选择不需要持久化到磁盘，刷新后恢复默认即可）
- 不做自动更新机制
- 不重构 Rust 核心算法（pHash / 分组 / NEF 解析）
- 不改变 PixiJS 画布的核心架构（层级结构、虚拟化机制保持不变）

## Decisions

### 1. 样式方案：CSS Module

**选择**：CSS Module（`.module.css`）  
**替代方案**：Tailwind CSS、CSS-in-JS（styled-components / emotion）、继续内联样式  
**理由**：
- CSS Module 零运行时开销，Vite 原生支持，无需额外配置
- 与现有 CSS 变量体系完美兼容，类名自动 scope 避免冲突
- 相比 Tailwind，CSS Module 更适合组件级封装，学习曲线低
- 相比 CSS-in-JS，无运行时 bundle 开销，对性能敏感的桌面应用更合适
- 迁移路径清晰：每个组件的内联 `styles` 对象可直接映射为 `.module.css` 中的 class

### 2. 主题系统：CSS 变量 + data-theme 属性

**选择**：在 `:root` 和 `[data-theme="dark"]` 上定义双套 CSS 变量  
**替代方案**：CSS-in-JS ThemeProvider、Zustand 存储主题 token  
**理由**：
- CSS 变量继承机制天然支持主题切换，只需切换 `<html data-theme="dark">` 即可
- PixiJS Canvas 不受 CSS 主题影响（Canvas 内颜色由 JS 控制），只需处理 DOM 组件
- 新增一个 `useThemeStore` 管理当前主题值，提供 `toggleTheme` action
- 暗色主题色板使用保守策略：深灰背景（#1A1A2E / #16213E）+ 低饱和文字色，减少视觉疲劳

### 3. 动画库：motion（原 Framer Motion）

**选择**：`motion`（轻量版 Framer Motion）  
**替代方案**：原生 CSS transition/animation、react-spring、GSAP  
**理由**：
- `motion` 是 Framer Motion 的轻量独立包，API 简洁且 bundle 小
- 支持声明式 `animate`、`exit`、`layout` 动画，比手写 CSS 更易维护
- 使用范围有限（面板出场、Toast 滑入、对话框缩放），不会造成过度引入
- 相比 react-spring，motion 的 API 更直观；相比 GSAP，无 license 问题

### 4. Toast 通知：自研轻量组件

**选择**：自研 `Toast` 组件 + `useToastStore` 状态管理  
**替代方案**：react-hot-toast、sonner、notistack  
**理由**：
- 项目只需 4 种类型（success/error/warning/info）+ 自动消失 + 手动关闭
- 自研可完全控制样式一致性和主题适配，无第三方依赖
- 使用 Zustand store 管理 Toast 队列，与项目技术栈一致
- 代码量约 150 行（组件 + store），投入产出比合理

### 5. 错误处理策略：分层兜底

**架构**：
```
ErrorBoundary（React 顶层）
  └─ Toast 通知（业务级错误反馈）
       └─ try-catch（IPC 调用级错误捕获）
```

- **ErrorBoundary**：捕获未处理的 React 渲染错误，显示回退 UI + 重试按钮
- **Toast 通知**：IPC 调用失败时通过 Toast 展示用户友好消息，可选重试
- **Rust AppError 扩展**：增加 `CacheError`、`ExportError`、`ConfigError`、`HashError` 变体，每个变体附带 `user_message()` 方法返回中文友好提示

### 6. 性能优化策略

- **纹理 LRU 容量**：当前固定 300 个纹理上限。增加基于纹理尺寸的内存估算，thumbnail (~200KB) / medium (~2MB)，总内存上限 300MB
- **ImageInfoOverlay 隐藏阈值**：保持现有 30% 阈值，确认无需调整
- **Semaphore 并发数**：保持 8 路，与 CPU 核心数适配
- **BitmapFont**：评估 PixiJS 8 的文字渲染性能，如有必要预生成 BitmapFont atlas

### 7. 打包配置

- **图标**：需提供 `icon.ico`（Windows）和 `icon.png` 系列（32/128/256）
- **安装器**：使用 Tauri 默认的 NSIS 安装器
- **元数据**：设置 `productName`、`version`、`identifier`、`copyright`
- **CSP**：保持现有安全策略不变

## Risks / Trade-offs

**[风险] CSS Module 迁移范围大** → 分批迁移：先通用组件（Button/Slider/Badge），再面板组件，最后页面组件。每迁移一个组件即运行视觉验证。

**[风险] 暗色主题在 PixiJS Canvas 中不一致** → Canvas 内的颜色（占位色块、信息覆盖层、分组标题）需要在主题切换时通过 JS 同步更新，而非 CSS 变量。需要在 CanvasImageItem / GroupTitle 中监听主题变化。

**[风险] motion 库 bundle 增量** → motion 包约 30KB gzip，对桌面应用可接受。仅在 DOM 组件中使用，不影响 PixiJS 渲染循环。

**[风险] 全量回归测试覆盖不足** → 重点验证：样式迁移后组件渲染是否正常、主题切换是否所有变量生效、动画不影响交互事件、Toast 不遮挡关键 UI。

**[Trade-off] 自研 Toast vs 三方库** → 自研需要测试覆盖（动画定时器、队列管理），但获得完全的样式控制权和零外部依赖。
