## 1. Rust 后端：缓存查询与清理

- [x] 1.1 在 `cache.rs` 中新增 `get_cache_size()` 异步函数，遍历 medium/ + thumbnail/ 返回 (total_bytes, file_count)
- [x] 1.2 在 `cache.rs` 中新增 `clear_all_cache()` 异步函数，删除两个子目录下所有文件
- [x] 1.3 为 `get_cache_size()` 和 `clear_all_cache()` 编写 Rust 单元测试
- [x] 1.4 新增 `src-tauri/src/commands/cache_commands.rs`，实现 `get_cache_size` 和 `clear_cache` IPC 命令
- [x] 1.5 在 `commands/mod.rs` 注册 `cache_commands` 模块
- [x] 1.6 在 `lib.rs` 的 `invoke_handler` 注册新命令
- [x] 1.7 运行 `cargo check` 和 `cargo test` 验证

## 2. 前端服务层：缓存 IPC 封装

- [x] 2.1 新增 `src/services/cacheService.ts`，封装 `getCacheSize()` 和 `clearCache()` IPC 调用
- [x] 2.2 在 `cacheService.ts` 中实现 `formatCacheSize()` 工具函数
- [x] 2.3 为 `cacheService.ts` 和 `formatCacheSize()` 编写前端单元测试

## 3. 前端 UI：设置面板组件

- [x] 3.1 新增 `src/components/panels/SettingsPanel.module.css` 样式文件
- [x] 3.2 新增 `src/components/panels/SettingsPanel.tsx`，实现右侧滑出面板框架（遮罩 + 动画 + 关闭）
- [x] 3.3 实现设置面板分组参数区域（相似度滑块 + 时间间隔滑块 + 防抖重分组）
- [x] 3.4 实现设置面板外观设置区域（检测框覆盖层开关）
- [x] 3.5 实现设置面板缓存管理区域（路径 + 大小 + 文件数 + 刷新 + 清理按钮）
- [x] 3.6 实现缓存清理内联确认（二次点击）和 loading 状态

## 4. 前端 UI：TopNavBar 变更

- [x] 4.1 从 TopNavBar 移除分组参数 popover 相关代码（IconTune、state、handler、JSX）
- [x] 4.2 从 TopNavBar 移除检测框切换按钮
- [x] 4.3 在 TopNavBar 新增设置按钮（IconSettings 齿轮图标）和 `onOpenSettings` prop
- [x] 4.4 清理 TopNavBar.module.css 中不再使用的 popover 样式

## 5. 前端集成：MainPage 和 InfiniteCanvas

- [x] 5.1 在 `InfiniteCanvasHandle` 接口新增 `clearMemoryCache()` 方法
- [x] 5.2 在 `MainPage.tsx` 中新增 `showSettings` state
- [x] 5.3 在 `MainPage.tsx` 中渲染 `SettingsPanel` 组件
- [x] 5.4 实现 `handleCacheCleared` 回调：清内存缓存 + 自动重处理 + Toast 提示
- [x] 5.5 将 `onOpenSettings` 传递给 TopNavBar

## 6. 验证与测试

- [x] 6.1 运行 `npx tsc --noEmit` 类型检查通过
- [x] 6.2 运行 `npx vitest run` 前端测试通过
- [x] 6.3 运行 `cargo test` Rust 测试通过
- [ ] 6.4 手动验证：设置面板打开/关闭、分组参数调节、检测框开关、缓存大小显示、清理缓存 + 自动重处理
