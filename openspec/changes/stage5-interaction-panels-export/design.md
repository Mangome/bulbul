## Context

Bulbul 是一款 Tauri v2 + React + PixiJS 的 RAW 图像筛选桌面应用。Stage 1~4 已完成：NEF 解析 + pHash 分组 + 无限画布瀑布流渲染。当前状态：

- **画布层**：`InfiniteCanvas.tsx` 管理 PixiJS Application，`CanvasImageItem.ts` 为纯 PixiJS Container（非 React 组件），已实现纹理加载、占位色块、信息覆盖层
- **Store 层**：`useSelectionStore` 已有 `toggleSelection` / `clearSelection` / `getSelectedInGroup`；`useAppStore` 管理分组数据和导航；`useCanvasStore` 管理缩放/平移
- **Rust 端**：`export_commands.rs` 为 `todo!()` 空壳；`SessionState` 已有 `hash_path_map`（hash → 原始 RAW 路径映射）
- **架构约束**：画布内元素使用纯 PixiJS 对象（非 React 组件），悬浮面板使用 React DOM 组件覆盖在画布之上

## Goals / Non-Goals

**Goals:**

- 实现画布内图片的选中/取消和悬停视觉反馈
- 提供悬浮分组列表，支持导航到对应分组
- 提供底部控制栏，统一缩放和导出入口
- 实现键盘快捷键系统，提升操作效率
- 完成 Rust 端批量导出逻辑，支持进度推送和错误收集
- 达到 MVP 可用状态：选择文件夹 → 处理 → 浏览 → 选中 → 导出

**Non-Goals:**

- 暗色/亮色主题切换（Stage 6）
- 动画过渡和视觉打磨（Stage 6）
- 性能优化和内存控制（Stage 6）
- 用户配置持久化
- 导出格式选择（仅复制原始 RAW 文件）

## Decisions

### 1. 选中/悬停状态在 CanvasImageItem 内部管理

**决策**：扩展 `CanvasImageItem` 类，新增 `setSelected(bool)` 和 `setHovered(bool)` 方法，内部管理选中边框、✓ 标记和悬停边框的 Graphics 对象。

**理由**：`CanvasImageItem` 是纯 PixiJS Container，保持 OOP 封装，由 InfiniteCanvas 在事件处理时调用。比在外部维护一套 SelectionIndicator 更内聚。

**替代方案**：独立 `SelectionIndicator` 类叠加在 item 上 → 增加层级管理复杂度，且 hit area 重叠。

### 2. 悬浮面板使用 React DOM 组件，绝对定位在画布上层

**决策**：`FloatingGroupList` 和 `FloatingControlBar` 是标准 React 组件，通过 CSS `position: fixed` 悬浮在 PixiJS canvas 之上。

**理由**：文本密集型 UI（列表、滑块、按钮）用 DOM 渲染远优于 PixiJS 文字渲染（性能和可访问性）。PixiJS canvas 作为底层，DOM 面板作为 HUD 层，互不干扰。

**替代方案**：在 PixiJS 内用 Graphics + Text 绘制面板 → 交互复杂度高、文字渲染性能差、无法使用浏览器原生输入控件。

### 3. 键盘快捷键用自定义 Hook + 全局事件监听

**决策**：`useKeyboard` hook 在 `MainPage` 挂载时注册 `window.addEventListener('keydown', ...)`，内部维护快捷键映射表。

**理由**：轻量实现，无需引入第三方快捷键库。快捷键数量有限（~10 个），映射表易维护。

**替代方案**：使用 `mousetrap` 或 `hotkeys-js` → 引入额外依赖，当前规模不值得。

### 4. Rust 导出采用 tokio::fs::copy 逐文件串行复制 + 进度推送

**决策**：遍历 hashes，逐个通过 `tokio::fs::copy` 复制 RAW 文件到目标目录，每完成一个文件 emit `export-progress` 事件。文件名冲突时追加 `_1`、`_2` 后缀。

**理由**：导出操作是 IO 密集型但文件数量不大（用户选中的通常几十张），串行复制足够快且逻辑简单。单文件失败不阻断后续，错误收集到 `ExportResult.failedFiles`。

**替代方案**：并发复制 → 复杂度增加，磁盘 IO 并发收益有限（同一磁盘瓶颈），不值得。

### 5. 通用组件 inline 样式 + CSS 变量

**决策**：Button、Slider、Badge 组件使用 inline style + CSS 自定义属性，不引入 CSS-in-JS 库。

**理由**：组件数量少（3 个），复杂度低，inline style 避免样式文件膨胀。CSS 变量在 Stage 6 主题切换时可直接复用。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| PixiJS 交互事件与 DOM 面板事件冲突（点击穿透） | 面板 DOM 设置 `pointer-events: auto`，PixiJS canvas 区域正常接收事件；面板区域 `stopPropagation` |
| CanvasImageItem 内 Graphics 对象增多影响内存 | 选中/悬停 Graphics 延迟创建（首次交互时），非激活状态设 `visible: false` 而非销毁 |
| 键盘事件在输入框聚焦时误触发 | `useKeyboard` 检查 `document.activeElement` 是否为 input/textarea，是则跳过 |
| 导出大量文件时 UI 无响应 | Rust 异步命令不阻塞前端，进度事件实时推送，前端展示进度 |
