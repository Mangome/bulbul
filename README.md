# Bulbul - RAW 图像智能筛选工具

[![Tauri](https://img.shields.io/badge/Tauri-2-blue?logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-Latest-CE422B?logo=rust)](https://www.rust-lang.org)

专为鸟友设计的快速筛图应用。自动将连拍照片智能分组，配合放大镜检查合焦，一键导出精选图片。

连拍一时爽，选片不再慌！

## 功能概览

### 智能分组

- 自动按拍摄时间和构图相似度将连拍照片归组
- 分组参数可调：相似度阈值（50%-100%）和时间间隔（1-120 秒）
- 自动评估每张照片的合焦程度（1-5 星），帮你快速定位最清晰的一张

### 画布浏览

- 瀑布流布局，分组标题清晰分隔
- 滚轮缩放（10%-300%），拖拽平移，流畅浏览大量图片
- 每张图片下方显示文件名、拍摄时间和参数

### 放大镜

- 在图片上按住左键拖动，弹出 1:1 像素级放大镜
- 无需切换视图，直接检查对焦细节
- 松开即消失，不干扰浏览节奏

### 批量导出

- 点击选中多张图片，按 `Ctrl+E` 或点击导出按钮
- 复制原始 RAW 文件到指定目录，同名文件自动重命名

---

## 使用指南

### 打开文件夹

启动应用后，点击**选择文件夹**按钮，选择包含 NEF 文件的目录。应用会自动扫描、分组并展示结果。

> 目前仅支持 Nikon NEF 格式，不扫描子目录。

### 处理过程

选择目录后会显示进度对话框，包含以下阶段：

| 阶段       | 说明                               |
| ---------- | ---------------------------------- |
| 扫描文件   | 查找目录下的 NEF 文件              |
| 处理图片   | 提取预览图和 EXIF 元数据           |
| 分析相似度 | 计算感知哈希                       |
| 分组       | 按时间+相似度聚类                  |
| 合焦评分   | 评估清晰度（后台进行，不阻塞操作） |

处理过程中可随时点击**取消**中断。合焦评分在后台异步进行，分组完成后即可开始浏览和选片。

### 浏览与选片

#### 鼠标操作

| 操作             | 效果                |
| ---------------- | ------------------- |
| 滚轮             | 缩放画布            |
| 点击图片         | 选中 / 取消选中     |
| 在图片上按住拖动 | 弹出 1:1 像素放大镜 |
| 悬停图片         | 显示淡色描边        |

#### 键盘快捷键

| 快捷键    | 功能                |
| --------- | ------------------- |
| `←` / `A` | 上一分组            |
| `→` / `D` | 下一分组            |
| `W` / `S` | 上下滚动到相邻分组  |
| `Ctrl+A`  | 全选当前分组        |
| `Q`       | 清除所有选中        |
| `Esc`     | 清除选中 / 取消处理 |
| `Ctrl+O`  | 打开新目录          |
| `Ctrl+E`  | 导出选中图片        |

> 输入框聚焦时快捷键不生效。

#### 底部胶片条

窗口底部的胶片条显示每个分组的代表图和数量，点击即可跳转到对应分组。键盘切换分组时胶片条自动跟随滚动。

#### 顶部导航栏

| 区域 | 功能                                               |
| ---- | -------------------------------------------------- |
| 左侧 | 分组导航箭头 + 当前分组名称                        |
| 中间 | 分组进度（如 3/15）+ 进度条                        |
| 路径 | 当前目录缩略路径，点击复制完整路径                 |
| 右侧 | 检测框开关 / 分组参数 / 切换目录 / 主题切换 / 导出 |

### 调整分组参数

点击导航栏右侧的**分组参数**按钮，弹出调整面板：

- **相似度阈值**（50%-100%）：值越高，只有非常相似的图片才会被分到一组
- **时间间隔**（1-120 秒）：两张照片拍摄时间差超过此值时不会被分到一组

调整后自动重新分组，无需重新扫描。

### 导出

1. 点击选中想要导出的图片（可跨分组多选）
2. 点击导航栏右侧的**导出**按钮或按 `Ctrl+E`
3. 选择目标目录
4. 等待导出完成，Toast 提示结果

导出的是原始 RAW 文件，不是格式转换。

---

## 开发指南

### 环境要求

- Node.js 18+
- Rust 1.70+（通过 [rustup](https://rustup.rs) 安装）
- Windows: Microsoft Visual C++ Build Tools 或 Visual Studio

### 常用命令

```bash
# 安装依赖
npm install

# 启动开发环境（Rust + React 热更新）
npm run tauri dev

# 生产构建
npm run tauri build

# 仅前端开发
npm run dev          # 开发服务器
npm run build        # 生产构建

# 类型检查
npx tsc --noEmit

# 测试
npx vitest run                         # 前端全部测试
npx vitest run src/hooks/useImageLoader.test.ts  # 单个测试
cd src-tauri && cargo test              # Rust 测试
cd src-tauri && cargo test focus_score  # 指定模块测试
```

### 项目结构

```
bulbul/
├── src/                          # 前端 React 代码
│   ├── components/
│   │   ├── canvas/               # 画布组件（InfiniteCanvas、CanvasImageItem、Loupe）
│   │   ├── panels/               # 面板（TopNavBar、BottomFilmstrip、ProgressDialog）
│   │   ├── dialogs/              # 对话框
│   │   └── common/               # 通用 UI 组件
│   ├── stores/                   # Zustand 状态管理
│   ├── services/                 # IPC 服务层
│   ├── hooks/                    # React Hooks
│   ├── utils/                    # 工具函数（布局计算等）
│   ├── windows/                  # 页面（WelcomePage、MainPage）
│   └── styles/                   # CSS + 主题系统
│
├── src-tauri/                    # Rust 后端代码
│   ├── src/
│   │   ├── commands/             # Tauri IPC 命令
│   │   ├── core/                 # 核心算法（NEF 解析、pHash、分组、合焦评分）
│   │   ├── models/               # 数据模型
│   │   └── utils/                # 工具函数（缓存等）
│   └── Cargo.toml
│
└── package.json
```

### 技术栈

- **前端**: React 18 + TypeScript + Zustand + Canvas 2D
- **后端**: Tauri 2 + Rust（NEF 解析、pHash、分组、合焦评分）
- **构建**: Vite 6
- **测试**: Vitest（前端）+ cargo test（后端）

### 关键注意事项

- InfiniteCanvas 使用 dirty flag + rAF 按需渲染，状态变化需调用 `markDirty()` 触发重绘
- EXIF orientation 5-8 表示旋转，后端自动交换 width/height，前端做视觉旋转
- 前端测试需要 mock Canvas 2D context、matchMedia、ResizeObserver 和 Tauri 的 `invoke()`
- 用户偏好持久化到 `$APPDATA/bulbul/settings.json`，500ms 防抖写入

### 代码规范

- TypeScript 严格模式，完整类型注解
- Rust 遵循 Clippy lint
- React 函数组件 + Hooks，Zustand 状态管理
- 单元测试覆盖率目标 ≥ 80%

### 故障排除

**Windows 编译报错**：确保已安装 Microsoft Visual C++ Build Tools。

**Rust 编译缓慢**：启用增量编译 `export CARGO_BUILD_PIPELINED_COMPILATION=true`。

**开发窗口不显示**：检查 `src-tauri/tauri.conf.json` 中窗口的 `visible: false` 设置，前端初始化完成后才显示。

## 许可证

MIT
