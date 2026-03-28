## Why

Stage 1~5 已完成 MVP 全部功能（NEF 解析 → pHash 分组 → 画布浏览 → 选中导出），但当前 UI 采用内联样式、缺乏主题系统、无动画过渡、错误处理不完善、未配置生产打包。Stage 6 旨在将项目从"功能可用"提升到"可发布"状态——专业的视觉设计、流畅的性能体验、完善的错误兜底、以及可构建的安装包。

## What Changes

- **视觉设计全面升级**：引入 CSS Module 样式方案，替代所有组件的内联 `styles` 对象；建立暗色/亮色双主题 CSS 变量体系；对欢迎页、主窗口、悬浮面板、控制栏、进度对话框进行创意设计升级，使其具备专业摄影工具的视觉质感
- **动画与过渡**：集成 motion 动画库，为面板出场、对话框弹出、按钮交互、分组切换等场景添加流畅过渡动画
- **Toast 通知系统**：新增全局 Toast 通知组件，替代当前的 `alert()` 调用，支持 success / error / warning / info 四种类型和自动消失
- **错误处理完善**：Rust 端扩展 `AppError` 枚举，增加更多错误变体和用户友好消息；前端实现统一错误边界 + Toast 通知 + 可选重试机制
- **性能优化**：Rust 端并发参数调优；前端纹理 LRU 容量上限控制（GPU 纹理 ≤300MB）；PixiJS 信息覆盖层在小缩放下自动隐藏；BitmapFont 预渲染优化文字渲染性能
- **Tauri 打包配置**：完善生产环境构建配置（应用图标、Windows 安装器、签名配置、元数据）

## Capabilities

### New Capabilities
- `theme-system`: 暗色/亮色双主题 CSS 变量体系 + 主题切换机制
- `toast-notification`: 全局 Toast 通知组件，支持多类型消息队列展示
- `animation-transitions`: 基于 motion 库的 UI 动画过渡系统
- `error-boundary`: 前端全局错误边界 + 错误恢复机制
- `build-packaging`: Tauri 生产打包配置（图标、安装器、签名）

### Modified Capabilities
- `data-models`: 扩展 `AppError` 枚举，增加 `CacheError`、`ExportError`、`ConfigError`、`HashError` 等变体；增加用户友好错误消息方法
- `common-ui-components`: Button / Slider / Badge 组件迁移到 CSS Module，增加主题适配 + 动画交互
- `floating-control-bar`: 迁移到 CSS Module，增加主题切换按钮，视觉升级 + 动画过渡
- `floating-group-list`: 迁移到 CSS Module，增加列表项动画、选中态过渡效果
- `frontend-structure`: 新增 `components/feedback/` 目录（Toast、ErrorBoundary），样式方案从内联样式迁移到 CSS Module
- `tauri-config`: 增加 bundle 完整配置（图标、Windows NSIS 安装器、应用元数据）
- `frontend-progress`: ProgressDialog 迁移到 CSS Module，增加动画过渡效果
- `canvas-image-item`: ImageInfoOverlay 在低缩放级别下自动隐藏优化
- `viewport-virtualization`: 纹理 LRU 容量控制优化（内存上限 ≤300MB）
- `image-selection-interaction`: 选中/取消动画过渡效果

## Impact

- **前端全部组件**：样式方案从内联样式迁移到 CSS Module，约涉及 15+ 个组件文件
- **CSS 变量体系**：`variables.css` 全面扩展，增加暗色主题变量集
- **新增依赖**：`motion`（动画库）
- **Rust 端**：`models/error.rs` 扩展错误类型；并发参数可能涉及 `process_commands.rs`
- **构建配置**：`tauri.conf.json` bundle 部分、`icons/` 目录、`capabilities/default.json`
- **测试**：需全量回归测试，确保样式迁移和重构未引入功能回归
