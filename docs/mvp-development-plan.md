# Bulbul MVP 开发计划

> 基于 `reference/bulbul-technical-requirements.md` 技术需求文档，按 MVP 思想拆分为 6 个阶段，每阶段代码量控制在 ~2000 行，支持多 Agent 并行开发。

---

## 项目现状

项目目前为 `create-tauri-app` 生成的纯脚手架模板，仅有一个 `greet` 示例命令，尚未开始任何业务开发。

---

## 整体阶段划分

```
Stage 1: 项目骨架 + 数据模型 + 基础 IPC     → 可运行的双窗口应用
Stage 2: NEF 解析核心 + 缓存系统            → 能解析 NEF 文件并提取 JPEG
Stage 3: pHash + 分组 + 完整处理流水线       → 端到端处理一个文件夹
Stage 4: PixiJS 无限画布 + 瀑布流布局       → 能浏览分组图片
Stage 5: 交互完善 + 悬浮面板 + 导出功能      → 完整可用的 MVP
Stage 6: 性能优化 + 视觉打磨 + 打包         → 可发布状态
```

---

## Stage 1: 项目骨架 + 数据模型 + 基础 IPC

**目标**: 搭建完整的项目骨架，双窗口可运行，IPC 通路跑通

**预估代码量**: ~2000 行（Rust ~1100 行，前端 ~900 行）

### Agent 分工

| Agent | 职责 | 产出文件 | 预估行数 |
|-------|------|---------|---------|
| **Agent A — Rust 骨架** | 模块结构 + 数据模型 + 状态管理 + 基础 Commands | `main.rs`, `lib.rs`, `models/` (4 文件), `state/` (2 文件), `commands/mod.rs`, `core/mod.rs`, `utils/mod.rs` | ~700 行 |
| **Agent B — 前端骨架** | 目录结构 + 路由 + Zustand Store + IPC 服务封装 + 类型定义 | `App.tsx`, `main.tsx`, `windows/` (2 文件), `stores/` (3 文件), `services/` (4 文件), `types/index.ts`, `styles/` (2 文件) | ~700 行 |
| **Agent C — 配置集成** | Tauri 配置 + Cargo 依赖 + npm 依赖 + 能力权限 + 多窗口配置 | `tauri.conf.json`, `Cargo.toml`, `package.json`, `capabilities/default.json` | ~300 行 |

### 并行策略

- **A 与 C 并行**: Agent C 先完成配置，Agent A 在此基础上编写 Rust 代码
- **B 与 C 并行**: Agent C 先完成 npm 依赖配置，Agent B 搭建前端结构
- **A 与 B 完全并行**: 两者通过 `types/index.ts` ↔ `models/` 约定数据结构即可独立开发

### 单元测试要求

| 测试范围 | 测试内容 | 负责 Agent |
|---------|---------|-----------|
| **数据模型** | 所有 Model 的序列化/反序列化、默认值、边界值验证 | Agent A |
| **状态管理** | `AppState` 的初始化、并发读写安全性 | Agent A |
| **IPC Commands** | 每个 Command 的正常路径 + 错误路径（使用 mock state） | Agent A |
| **Zustand Store** | Store 初始状态、action 触发后状态变更的正确性 | Agent B |
| **IPC 服务层** | `services/` 中每个函数的调用参数和返回值验证（mock `@tauri-apps/api`） | Agent B |

### 交付标准

- [ ] `cargo build` 编译通过
- [ ] `cargo test` 所有 Rust 单元测试通过
- [ ] `npm run tauri dev` 启动后显示欢迎窗口
- [ ] 欢迎窗口点击「选择文件夹」可以弹出系统文件选择对话框
- [ ] 选择文件夹后关闭欢迎窗口、打开主窗口
- [ ] 前端 Zustand Store 初始化正常，IPC 调用路径跑通
- [ ] 前端单元测试（vitest）全部通过，覆盖率 ≥ 80%

---

## Stage 2: NEF 解析核心 + 缓存系统

**目标**: 实现 NEF 文件的 TIFF IFD 解析、嵌入 JPEG 提取、Exif 元数据解析、缩略图生成、文件缓存

**预估代码量**: ~2000 行（Rust ~1800 行，前端 ~200 行）

### Agent 分工

| Agent | 职责 | 产出文件 | 预估行数 |
|-------|------|---------|---------|
| **Agent A — NEF/TIFF 解析器** | TIFF 头解析 + IFD 链遍历 + SubIFD 递归 + 嵌入 JPEG 定位提取 + JPEG 魔数验证 + `RawExtractor` trait | `core/nef_parser.rs`, `core/raw_processor.rs` | ~800 行 |
| **Agent B — Exif 元数据** | `kamadak-exif` 集成 + Exif 标签映射到 `ImageMetadata` + 时间解析 + GPS 坐标转换 | `core/metadata.rs` | ~500 行 |
| **Agent C — 缓存 + 工具** | 文件缓存目录管理 + MD5 路径哈希 + 缩略图生成（200px Lanczos3）+ 缓存命中检测 + 进度回调适配 | `utils/cache.rs`, `utils/paths.rs`, `commands/file_commands.rs`（扫描逻辑） | ~700 行 |

### 并行策略

- **A 与 B 完全并行**: NEF 解析器和 Exif 解析器是独立模块，通过 `&[u8]` 字节切片接口对接
- **C 与 A/B 并行**: 缓存系统不依赖具体解析逻辑，只需约定输入为 `Vec<u8>` (JPEG 数据) + `String` (hash)
- **集成点**: Stage 2 末尾做一次集成，A 的 JPEG 输出 → B 的 Exif 输入 → C 的缓存写入

### 单元测试要求

| 测试范围 | 测试内容 | 负责 Agent |
|---------|---------|-----------|
| **TIFF/IFD 解析** | 字节序识别（大/小端）、IFD 链遍历正确性、SubIFD 递归深度、无效 TIFF 头拒绝 | Agent A |
| **JPEG 提取** | JPEG 魔数验证（SOI/EOI）、正确提取嵌入 JPEG 的偏移和长度、损坏 NEF 文件的错误处理 | Agent A |
| **Exif 解析** | 常见标签映射正确性、时间字符串解析（多种格式）、GPS 坐标转换精度、缺失标签的优雅降级 | Agent B |
| **缓存系统** | MD5 路径哈希一致性、缓存命中/未命中判断、缓存目录创建、缩略图尺寸验证（200px 宽） | Agent C |
| **缩略图生成** | 不同宽高比图片的缩放正确性、Lanczos3 输出质量、空/损坏图片数据的处理 | Agent C |

### 交付标准

- [ ] 给定一个 `.nef` 文件路径，能正确提取嵌入的 medium JPEG
- [ ] 能解析出完整的 `ImageMetadata`（拍摄时间、相机信息、曝光参数等）
- [ ] 生成 200px 宽缩略图并写入缓存目录
- [ ] 二次处理同文件时命中缓存、跳过解析
- [ ] `cargo test` 所有 Rust 单元测试通过，核心解析模块覆盖率 ≥ 85%
- [ ] 使用真实 NEF 样本文件的集成测试通过

---

## Stage 3: pHash + 分组 + 完整处理流水线

**目标**: 实现 pHash 感知哈希、相似度计算、自动分组算法，并将 Stage 2 的模块串联为完整的异步处理流水线

**预估代码量**: ~1800 行（Rust ~1200 行，前端 ~600 行）

### Agent 分工

| Agent | 职责 | 产出文件 | 预估行数 |
|-------|------|---------|---------|
| **Agent A — pHash + 相似度** | DCT-II 变换（rustdct）+ 9×8 灰度矩阵 + 64-bit hash 生成 + 汉明距离 + 相似度百分比 + LRU 缓存 | `core/phash.rs`, `core/similarity.rs` | ~500 行 |
| **Agent B — 分组算法 + 流水线** | 时间+相似度双条件分组 + 顺序扫描早期终止 + `process_commands.rs` 完整流水线（扫描→处理→分析→分组）+ tokio 并发（Semaphore 8 路）+ 进度事件推送 + 取消支持 | `core/grouping.rs`, `commands/process_commands.rs` | ~700 行 |
| **Agent C — 前端进度对接** | `useTauriEvents` hook + `useProcessing` hook + 进度对话框 `ProgressDialog.tsx` + 处理状态在 Store 中的流转 | `hooks/useTauriEvents.ts`, `hooks/useProcessing.ts`, `components/dialogs/ProgressDialog.tsx`, Store 更新 | ~600 行 |

### 并行策略

- **A 与 C 完全并行**: pHash 算法是纯计算，前端进度 UI 只依赖事件格式约定
- **B 依赖 A**: 分组算法需要调用 pHash，但 Agent B 可以先用 mock 数据开发分组逻辑，最后再替换为 Agent A 的真实 pHash
- **集成点**: A 完成 → B 集成真实 pHash → 联调进度事件 → C 前端展示

### 单元测试要求

| 测试范围 | 测试内容 | 负责 Agent |
|---------|---------|-----------|
| **pHash 计算** | DCT 变换输出正确性、灰度矩阵生成、64-bit hash 确定性（相同图片 → 相同 hash） | Agent A |
| **汉明距离** | 已知 hash 对的汉明距离计算、相似度百分比换算、边界值（完全相同=0、完全不同=64） | Agent A |
| **分组算法** | 时间间隔阈值边界、相似度阈值边界、单张图片成组、全部相似合并为一组、早期终止逻辑验证 | Agent B |
| **流水线** | 取消信号响应、并发 Semaphore 限制验证、空文件夹处理、混合文件类型过滤 | Agent B |
| **进度事件** | 进度百分比计算正确性、事件格式验证、`useTauriEvents` hook 状态流转 | Agent C |
| **前端 Hook** | `useProcessing` 各状态（idle → processing → completed / cancelled / error）转换正确性 | Agent C |

### 交付标准

- [ ] 给定两张图片路径，能计算相似度百分比
- [ ] 给定一个文件夹，完整运行「扫描 → NEF 处理 → pHash → 分组」流水线
- [ ] 前端能实时显示处理进度（百分比 + 当前文件 + 预估剩余时间）
- [ ] 支持中途取消处理
- [ ] 最终返回 `GroupResult` 到前端
- [ ] `cargo test` 所有 Rust 单元测试通过，pHash + 分组模块覆盖率 ≥ 85%
- [ ] 前端 Hook 单元测试通过

---

## Stage 4: PixiJS 无限画布 + 瀑布流布局

**目标**: 实现 WebGL 无限画布、瀑布流布局引擎、虚拟化渲染、图片加载与纹理管理

**预估代码量**: ~2200 行（前端 ~2000 行，Rust ~200 行）

### Agent 分工

| Agent | 职责 | 产出文件 | 预估行数 |
|-------|------|---------|---------|
| **Agent A — 画布核心** | PixiJS Application 初始化 + Stage 层级结构 + 滚轮缩放（锚点缩放）+ 拖拽平移 + 视口管理 + 波点底纹（TilingSprite） | `components/canvas/InfiniteCanvas.tsx`, `components/canvas/DotBackground.tsx`, `stores/useCanvasStore.ts` | ~800 行 |
| **Agent B — 布局 + 虚拟化** | 瀑布流布局算法（3 列 + 分组标题 + 间距）+ 视口裁剪引擎 + 纹理 LRU 管理（进入/离开视口加载/卸载）+ 分级加载（缩放阈值切换 thumbnail/medium） | `utils/layout.ts`, `hooks/useImageLoader.ts`（纹理管理部分） | ~700 行 |
| **Agent C — 图片项渲染 + Rust 图片服务** | `CanvasImageItem` (Sprite + 占位色块 + 加载态) + `ImageInfoOverlay`（底部渐变 + Badge）+ Rust 端 `image_commands.rs`（`get_image_url` + `get_metadata`）+ `convertFileSrc` 封装 | `components/canvas/CanvasImageItem.tsx`, `components/canvas/ImageInfoOverlay.tsx`, `commands/image_commands.rs`, `services/imageService.ts` | ~700 行 |

### 并行策略

- **A、B、C 三路并行**:
  - Agent A 搭建画布容器 + 交互，不依赖具体图片内容
  - Agent B 实现纯算法（布局 + 虚拟化），输入输出是数据结构
  - Agent C 开发图片项组件 + Rust 图片服务
- **集成点**: A 提供 ContentLayer 容器 → B 计算布局坐标 → C 的 ImageItem 按坐标放置到容器中

### 单元测试要求

| 测试范围 | 测试内容 | 负责 Agent |
|---------|---------|-----------|
| **瀑布流布局** | 列数分配正确性、分组标题高度计算、不同宽高比图片的布局坐标、空分组处理、单列退化场景 | Agent B |
| **视口裁剪** | 视口边界内/外元素判定、视口变化时的增量更新、极端缩放下的裁剪正确性 | Agent B |
| **纹理 LRU** | 缓存容量限制、LRU 淘汰顺序、重复加载同一纹理不重复创建、卸载回调触发 | Agent B |
| **Canvas Store** | 缩放级别限制（10%~300%）、平移偏移计算、视口矩形更新 | Agent A |
| **图片服务** | `get_image_url` 路径转换正确性、`get_metadata` 返回结构验证、无效路径错误处理 | Agent C |

### 交付标准

- [ ] 处理完成后，主窗口显示所有分组图片的瀑布流布局
- [ ] 滚轮缩放（10%~300%）和拖拽平移流畅
- [ ] 只加载视口内图片的纹理，视口外纹理自动卸载
- [ ] 每张图片底部显示文件名 + 拍摄参数信息
- [ ] 波点底纹正常显示且不受缩放影响
- [ ] 布局算法单元测试通过，覆盖率 ≥ 85%
- [ ] 前端组件和 Store 单元测试通过

---

## Stage 5: 交互完善 + 悬浮面板 + 导出功能

**目标**: 实现图片选中/悬停效果、悬浮分组列表、底部控制栏、批量导出、键盘快捷键

**预估代码量**: ~2000 行（前端 ~1500 行，Rust ~500 行）

### Agent 分工

| Agent | 职责 | 产出文件 | 预估行数 |
|-------|------|---------|---------|
| **Agent A — 选中交互 + 悬浮面板** | 图片点击选中（toggle）+ 选中边框 + ✓ 标记 + 悬停高亮 + `FloatingGroupList` + `GroupListItem` + 分组点击跳转 + `useSelectionStore` 完善 | `components/canvas/SelectionIndicator.tsx`, `components/panels/FloatingGroupList.tsx`, `components/panels/GroupListItem.tsx`, `stores/useSelectionStore.ts` 完善 | ~800 行 |
| **Agent B — 控制栏 + 键盘** | `FloatingControlBar`（缩放滑块 + 适应窗口 + 实际大小 + 导出按钮）+ 通用组件（Button, Slider, Badge）+ `useKeyboard` hook（W/S 分组切换 + Ctrl 快捷键） | `components/panels/FloatingControlBar.tsx`, `components/common/Button.tsx`, `components/common/Slider.tsx`, `components/common/Badge.tsx`, `hooks/useKeyboard.ts` | ~700 行 |
| **Agent C — 导出功能** | Rust `export_commands.rs`（批量复制 + 进度推送 + 冲突重命名 + 错误收集）+ 前端 `exportService.ts` + 导出结果通知 UI | `commands/export_commands.rs`, `services/exportService.ts`, 导出相关 UI | ~500 行 |

### 并行策略

- **A、B、C 三路完全并行**:
  - Agent A 专注画布内交互 + 左侧面板
  - Agent B 专注底部控制栏 + 键盘 + 通用组件
  - Agent C 专注 Rust 导出逻辑 + 前端服务封装
- **无依赖冲突**: 三者操作不同文件，通过 Store 接口解耦

### 单元测试要求

| 测试范围 | 测试内容 | 负责 Agent |
|---------|---------|-----------|
| **选中状态管理** | 单选 toggle、多选状态维护、全选/取消全选、跨分组选中隔离 | Agent A |
| **分组列表** | 分组数据到列表项的映射、点击跳转坐标计算、空分组过滤 | Agent A |
| **键盘快捷键** | W/S 循环切换逻辑（到末尾回到开头）、Ctrl 组合键绑定、焦点管理 | Agent B |
| **通用组件** | Button / Slider / Badge 的 props 渲染、Slider 值变化回调、disabled 状态 | Agent B |
| **导出逻辑（Rust）** | 批量复制正确性、文件名冲突重命名规则、目标目录不存在时自动创建、部分失败时错误收集 | Agent C |
| **导出服务（前端）** | `exportService` 参数组装、进度回调处理、导出结果状态映射 | Agent C |

### 交付标准

- [ ] 点击图片可选中/取消，显示蓝色边框 + ✓ 标记
- [ ] 左侧分组列表正常显示，点击跳转到对应分组
- [ ] 底部控制栏缩放滑块、适应窗口、实际大小功能正常
- [ ] W/S 键循环切换分组
- [ ] 选中图片后点击「导出」，选择目录后完成 RAW 文件复制
- [ ] `cargo test` 导出模块单元测试全部通过
- [ ] 前端组件 + Hook + Store 单元测试全部通过
- [ ] **至此达到 MVP 可用状态** ✅

---

## Stage 6: 性能优化 + 视觉打磨 + 打包

**目标**: 性能调优、UI 设计升级（使用 frontend-design skill）、动画过渡、错误处理完善、打包发布

**预估代码量**: ~1500 行（前端 ~1000 行，Rust ~300 行，配置 ~200 行）

### Agent 分工

| Agent | 职责 | 产出文件 | 预估行数 |
|-------|------|---------|---------|
| **Agent A — 视觉设计** | 使用 frontend-design skill 对欢迎页 + 主窗口 + 面板 + 控制栏进行创意设计升级、动画过渡（motion 库）、暗色/亮色主题 CSS 变量 | 样式文件 + 组件视觉调整 | ~700 行 |
| **Agent B — 性能优化** | Rust 端并发参数调优 + 前端纹理 LRU 容量调优 + 信息覆盖层缩放阈值隐藏 + BitmapFont 预渲染 + 内存控制（GPU 纹理 ≤300MB）| 各模块内优化 | ~400 行 |
| **Agent C — 错误处理 + 打包** | Rust `AppError` 完善 + 前端 Toast 通知 + 重试机制 + Tauri 打包配置（图标/签名/安装器）+ README | `models/error.rs` 完善, 打包配置, 前端错误 UI | ~400 行 |

### 并行策略

- **A、B、C 三路完全并行**: 视觉设计、性能调优、错误处理是三个独立方向

### 单元测试要求

| 测试范围 | 测试内容 | 负责 Agent |
|---------|---------|-----------|
| **主题系统** | CSS 变量在暗色/亮色主题下的正确切换、组件在不同主题下的渲染验证 | Agent A |
| **性能基准** | 纹理 LRU 容量上限验证（≤300MB）、Semaphore 并发数限制、大数据集（1000+）下的布局计算耗时 | Agent B |
| **错误处理（Rust）** | `AppError` 各变体的序列化格式、错误链传播、用户友好消息生成 | Agent C |
| **错误处理（前端）** | Toast 通知触发条件、重试逻辑的次数限制和退避策略、网络/IPC 错误的分类展示 | Agent C |
| **回归测试** | 全量运行 Stage 1~5 的所有单元测试，确保优化和重构未引入回归 | 全体 Agent |

### 交付标准

- [ ] UI 具有专业摄影工具的视觉质感
- [ ] 1000 张图片场景下画布 60fps 流畅
- [ ] 所有错误场景有友好提示
- [ ] Windows 安装包可正常构建
- [ ] `cargo test` 全量通过，整体 Rust 代码覆盖率 ≥ 80%
- [ ] 前端 `vitest` 全量通过，整体前端代码覆盖率 ≥ 80%
- [ ] 无回归测试失败

---

## 总览表

| 阶段 | 核心目标 | 代码量 | Agent 数 | 并行度 | 测试重点 |
|------|---------|--------|---------|--------|---------|
| **Stage 1** | 项目骨架 + 双窗口 + IPC | ~2000 行 | 3 | A∥B∥C | 数据模型 + Store + IPC 服务 |
| **Stage 2** | NEF 解析 + 缓存 | ~2000 行 | 3 | A∥B∥C | TIFF/JPEG 解析 + Exif + 缓存 |
| **Stage 3** | pHash + 分组 + 流水线 | ~1800 行 | 3 | A∥C, B→A | pHash + 分组算法 + 流水线 |
| **Stage 4** | PixiJS 画布 + 布局 | ~2200 行 | 3 | A∥B∥C | 布局算法 + 视口裁剪 + LRU |
| **Stage 5** | 交互 + 面板 + 导出 | ~2000 行 | 3 | A∥B∥C | 选中状态 + 快捷键 + 导出 |
| **Stage 6** | 打磨 + 优化 + 打包 | ~1500 行 | 3 | A∥B∥C | 回归测试 + 错误处理 + 性能 |
| **合计** | — | **~11500 行** | — | — | **Rust ≥80% / 前端 ≥80%** |

---

## 阶段间依赖关系

```
Stage 1 ──→ Stage 2 ──→ Stage 3 ──┐
                                    ├──→ Stage 5 ──→ Stage 6
              Stage 1 ──→ Stage 4 ──┘
```

- **Stage 4 可与 Stage 2/3 并行开发**: 画布 UI 不依赖真实的 NEF 处理，可用 mock 数据开发
- **Stage 5 需要 Stage 3 + 4 完成**: 交互功能建立在真实数据 + 画布渲染之上
- **Stage 6 需要 Stage 5 完成**: 打磨基于功能完整的 MVP

---

## 测试规范（全局）

### 测试工具链

| 端 | 测试框架 | 覆盖率工具 | 运行命令 |
|----|---------|-----------|---------|
| **Rust** | `cargo test`（内置） | `cargo-tarpaulin` 或 `llvm-cov` | `cargo test --workspace` |
| **前端** | `vitest` | `@vitest/coverage-v8` | `npx vitest run --coverage` |

### 测试编写原则

1. **每个公共函数/方法都需要单元测试**：至少覆盖正常路径 + 一个错误路径
2. **Rust 端测试内嵌模块文件**：使用 `#[cfg(test)] mod tests { ... }` 模式，测试代码与源码同文件
3. **前端测试就近放置**：`xxx.ts` 对应 `xxx.test.ts`，放在同一目录下
4. **Mock 边界清晰**：Rust 端通过 trait + mock impl 解耦；前端通过 `vi.mock()` mock IPC 和外部依赖
5. **测试命名规范**：使用 `test_<功能>_<场景>_<预期>` 格式（Rust），`describe/it` 描述性命名（前端）
6. **CI 集成**：每个 Stage 交付前需 `cargo test` + `vitest run` 全量通过，不允许跳过或忽略失败用例
7. **测试数据管理**：Stage 2+ 需要的 NEF 样本文件放入 `tests/fixtures/`，使用 `.gitignore` 管理大文件，CI 中通过脚本下载

### 覆盖率目标

| 模块类型 | 最低覆盖率 |
|---------|-----------|
| 核心算法（NEF 解析 / pHash / 分组 / 布局） | ≥ 85% |
| 业务逻辑（Commands / Services / Stores） | ≥ 80% |
| 工具函数（utils） | ≥ 90% |
| UI 组件 | ≥ 70%（重点覆盖交互逻辑，纯渲染可适度放宽） |

---

## MVP 里程碑

**Stage 5 完成后即达到 MVP**，能完成完整工作流：

```
选择文件夹 → NEF 处理 → 相似度分组 → 画布浏览 → 选中导出
```

Stage 6 为发布前的打磨阶段。
