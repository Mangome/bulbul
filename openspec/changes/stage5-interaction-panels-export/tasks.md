## 1. 通用 UI 组件

- [ ] 1.1 创建 `src/components/common/Button.tsx`：支持 variant（primary/secondary/ghost）、size（sm/md）、disabled、onClick，inline style + CSS 变量
- [ ] 1.2 创建 `src/components/common/Slider.tsx`：支持 min/max/value/step/onChange 受控模式
- [ ] 1.3 创建 `src/components/common/Badge.tsx`：pill 形状数字/文本标签，支持不同颜色变体
- [ ] 1.4 为 Button/Slider/Badge 编写单元测试，验证 props 渲染、disabled 状态、值变化回调

## 2. SelectionStore 完善

- [ ] 2.1 在 `useSelectionStore` 中新增 `selectAllInGroup(groupHashes: string[])` 方法，将指定 hash 列表全部加入 selectedHashes
- [ ] 2.2 在 `useSelectionStore` 中新增 `deselectAllInGroup(groupHashes: string[])` 方法，将指定 hash 列表从 selectedHashes 中移除
- [ ] 2.3 补充 SelectionStore 单元测试：全选/取消全选、跨分组选中隔离、重复全选幂等性

## 3. 图片选中/悬停交互

- [ ] 3.1 扩展 `CanvasImageItem`：新增 `setSelected(selected: boolean)` 方法，绘制/隐藏蓝色选中边框（3px #3B82F6 + 2px 白色外阴影）和右上角蓝色圆形 ✓ 标记
- [ ] 3.2 扩展 `CanvasImageItem`：新增 `setHovered(hovered: boolean)` 方法，绘制/隐藏悬停高亮边框（2px #3B82F6 + 外发光）
- [ ] 3.3 在 `CanvasImageItem` 上设置 `eventMode = 'static'`，注册 `pointerover`/`pointerout` 事件调用 setHovered
- [ ] 3.4 在 `InfiniteCanvas` 中实现图片点击逻辑：区分点击与拖拽（5px 阈值），点击时调用 `useSelectionStore.toggleSelection` 并更新 CanvasImageItem 的选中视觉
- [ ] 3.5 实现 SelectionStore 状态变更后批量同步画布内所有可见 CanvasImageItem 的选中状态

## 4. 悬浮分组列表面板

- [ ] 4.1 创建 `src/components/panels/GroupListItem.tsx`：展示代表图缩略图（50×50）、分组名、图片数量、平均相似度、已选中数 Badge
- [ ] 4.2 创建 `src/components/panels/FloatingGroupList.tsx`：白色半透明毛玻璃容器，Header 显示 "相似度分组" + 分组总数，可滚动列表区域
- [ ] 4.3 实现分组点击跳转：点击 GroupListItem 调用 AppStore.selectGroup → 计算目标分组在布局中的 Y 坐标 → 设置画布 viewport 位置
- [ ] 4.4 实现当前选中分组高亮：根据 AppStore.selectedGroupId 渲染高亮背景
- [ ] 4.5 为 FloatingGroupList/GroupListItem 编写单元测试：分组数据映射、点击回调、空分组过滤、选中数 Badge 计算

## 5. 悬浮控制栏

- [ ] 5.1 创建 `src/components/panels/FloatingControlBar.tsx`：pill 形状毛玻璃容器，底部居中定位
- [ ] 5.2 实现缩放控件区域：`[-]` 按钮 + Slider（10%~300%）+ `[+]` 按钮 + 百分比显示，双向绑定 useCanvasStore.zoomLevel
- [ ] 5.3 实现视图控制区域：「适应窗口」和「实际大小」按钮，调用 useCanvasStore 对应方法
- [ ] 5.4 实现导出区域：「导出」按钮 + 选中数 Badge，disabled 状态绑定 SelectionStore.selectedCount === 0，点击触发导出流程
- [ ] 5.5 为 FloatingControlBar 编写单元测试：缩放联动、按钮状态、导出按钮 disabled 逻辑

## 6. 键盘快捷键

- [ ] 6.1 创建 `src/hooks/useKeyboard.ts`：在 MainPage 挂载时注册 window keydown 监听，卸载时移除
- [ ] 6.2 实现 W/S 键分组切换：调用 AppStore.navigateGroup('prev'/'next')，触发画布滚动到目标分组
- [ ] 6.3 实现 Ctrl 组合键：Ctrl+O 打开文件夹、Ctrl+E 导出、Ctrl+A 全选当前组、Ctrl+0 适应窗口、Ctrl+1 实际大小、Ctrl+= 放大、Ctrl+- 缩小
- [ ] 6.4 实现 Escape 键：有选中时清除选择，处理中时取消处理
- [ ] 6.5 实现输入框聚焦检测：activeElement 为 input/textarea/contenteditable 时跳过快捷键
- [ ] 6.6 为 useKeyboard 编写单元测试：各快捷键触发正确 action、输入框聚焦时跳过、Escape 多功能逻辑

## 7. Rust 导出功能

- [ ] 7.1 实现 `select_export_dir`：使用 `tauri-plugin-dialog` 的 `FileDialogBuilder::pick_folder` 打开文件夹选择对话框，返回 `Option<String>`
- [ ] 7.2 实现 `export_images` 核心逻辑：从 SessionState.hash_path_map 获取源路径 → 确保目标目录存在 → tokio::fs::copy 逐文件复制 → 返回 ExportResult
- [ ] 7.3 实现文件名冲突重命名：目标文件已存在时追加 `_1`/`_2`/... 后缀（保留原扩展名）
- [ ] 7.4 实现导出进度推送：每复制完一个文件 emit `export-progress` 事件 `{ current, total }`
- [ ] 7.5 实现错误收集：单文件复制失败时记录到 failed_files 列表，不阻断后续文件复制
- [ ] 7.6 更新 `export_images` 命令签名以接收 `window: tauri::Window` 和 `state: tauri::State<AppState>` 参数，在 `lib.rs` 中注册命令
- [ ] 7.7 为导出逻辑编写 Rust 单元测试：正常复制、冲突重命名、目标目录创建、部分失败错误收集

## 8. 前端导出流程集成

- [ ] 8.1 完善 `src/services/exportService.ts`：新增 `onExportProgress` 事件监听封装
- [ ] 8.2 在 MainPage 或 FloatingControlBar 中编排导出流程：获取 selectedHashes → selectExportDir → exportImages → 监听进度 → 展示结果通知 → clearSelection
- [ ] 8.3 实现简单的导出结果通知 UI（成功/失败数提示，可使用 alert 或简易 Toast）
- [ ] 8.4 为前端导出流程编写单元测试：参数组装、取消目录选择时终止、结果状态映射

## 9. MainPage 集成

- [ ] 9.1 在 MainPage 中引入 FloatingGroupList、FloatingControlBar 组件，布局为画布底层 + 左侧面板 + 底部控制栏
- [ ] 9.2 在 MainPage 中调用 useKeyboard hook 注册快捷键
- [ ] 9.3 传递分组数据、选中状态、缩放状态等 props/store 连接到各面板组件
- [ ] 9.4 确保面板 DOM 与 PixiJS canvas 事件不冲突（pointer-events 管理）

## 10. 端到端验证与测试补充

- [ ] 10.1 手动验证完整流程：选择文件夹 → 处理 → 浏览 → 选中图片 → 分组导航 → W/S 切换 → 导出
- [ ] 10.2 确保 `cargo test` 全部通过，导出模块覆盖率 ≥ 85%
- [ ] 10.3 确保 `npx vitest run` 全部通过，前端组件/Hook/Store 覆盖率 ≥ 80%
- [ ] 10.4 验证键盘快捷键在各场景下工作正常
