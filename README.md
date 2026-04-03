# Bulbul - RAW 图像智能筛选与管理工具

[![Tauri](https://img.shields.io/badge/Tauri-2-blue?logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Rust](https://img.shields.io/badge/Rust-Latest-CE422B?logo=rust)](https://www.rust-lang.org)

一个现代化的桌面应用，专为摄影师设计，帮助快速识别和管理 NEF 格式 RAW 图片，支持智能分组、视觉相似度匹配和批量导出。

## 🎯 核心功能

### 智能分组
- **时间与相似度双条件分组** - 自动按拍摄时间聚类，相似构图识别
- **感知哈希 (pHash)** - DCT-II 算法实现，对裁剪、压缩、亮度变化鲁棒
- **合焦评分** - 自动评估每张图片的清晰度（1-5 星）

### 完整元数据支持
提取 30+ 个 EXIF 字段：
- **时间**：拍摄时间、修改时间
- **相机**：品牌、型号、序列号
- **镜头**：型号、焦距、序列号
- **曝光**：光圈、快门速度、ISO
- **测光**：曝光模式、测光方式、曝光补偿
- **GPS**：纬度、经度、高度
- **其他**：白平衡、色彩空间、文件大小

### 高效渲染
- **PixiJS WebGL 画布** - 硬件加速，支持 1000+ 图片流畅交互
- **虚拟化渲染** - 动态加载视口内图片，LRU 纹理管理
- **灵活缩放** - 10%-300% 缩放范围，支持适应窗口和实际大小

### 交互与导出
- **直观选择** - 点击选中/取消，蓝色高亮标记
- **键盘快捷键** - W/S 循环分组，Ctrl+O 打开文件夹
- **批量导出** - 异步并发复制，文件名冲突自动重命名，进度实时反馈

### 主题与偏好持久化
- **Light/Dark 两种主题** - CSS 变量全局管理，流畅切换
- **缩放级别保存** - 自动记忆用户的缩放设置
- **防抖保存** - 500ms 延迟写入，保护频繁磁盘 I/O

## 🏗️ 项目结构

```
bulbul/
├── src/                          # 前端 React 代码
│   ├── components/               # React 组件库
│   │   ├── canvas/              # PixiJS 画布组件
│   │   ├── panels/              # 浮动面板（分组列表、控制栏）
│   │   ├── common/              # 通用 UI 组件
│   │   └── feedback/            # 反馈组件（Toast、ErrorBoundary）
│   ├── stores/                  # Zustand 状态管理
│   ├── services/                # IPC 服务层
│   ├── hooks/                   # React Hooks
│   ├── utils/                   # 工具函数
│   ├── windows/                 # 页面组件
│   └── styles/                  # CSS 样式 + 主题系统
│
├── src-tauri/                   # Rust 后端代码
│   ├── src/
│   │   ├── commands/            # Tauri IPC 命令
│   │   ├── core/                # 核心算法
│   │   │   ├── nef_parser.rs        # NEF/TIFF IFD 解析
│   │   │   ├── metadata.rs          # EXIF 元数据提取
│   │   │   ├── phash.rs             # 感知哈希算法
│   │   │   ├── grouping.rs          # 分组算法
│   │   │   └── focus_score.rs       # 合焦评分
│   │   ├── models/              # 数据模型
│   │   └── utils/               # 工具函数
│   └── Cargo.toml               # Rust 依赖
│
├── package.json                 # npm 依赖
├── tsconfig.json                # TypeScript 配置
├── vite.config.ts               # Vite 构建配置
└── docs/                        # 项目文档
```

## 🛠️ 技术栈

### 前端
- **框架**: React 18 + TypeScript 5.6
- **构建**: Vite 6
- **渲染**: PixiJS 8 (WebGL 画布)
- **状态管理**: Zustand 5
- **动画**: Motion 12
- **测试**: Vitest 3
- **UI**: 自定义组件库（Button、Slider、Badge 等）

### 后端
- **框架**: Tauri 2 (跨平台桌面框架)
- **异步运行时**: Tokio (full)
- **图像处理**: 
  - `image 0.25` - JPEG 解码、缩放、滤波
  - `rustdct 0.7` - DCT-II 离散余弦变换
- **元数据**:
  - `kamadak-exif 0.5` - EXIF 解析
  - `chrono 0.4` - 时间处理
- **性能**:
  - `lru 0.12` - 相似度 LRU 缓存
  - `md5 0.7` - 路径哈希
- **序列化**: serde/serde_json
- **错误处理**: thiserror

### 跨平台支持
- **Windows**: NSIS 安装器（多语言）
- **macOS**: DMG 分发
- **Linux**: AppImage

## 📦 快速开始

### 环境要求
- Node.js 18+
- Rust 1.70+ (通过 rustup 安装)
- Tauri CLI

### 开发环境

```bash
# 1. 安装依赖
npm install

# 2. 启动开发环境（自动编译 Rust + 热更新 React）
npm run tauri dev
```

### 生产构建

```bash
# 编译并打包应用
npm run tauri build

# 输出文件位置：
# - Windows: src-tauri/target/release/bundle/nsis/
# - macOS: src-tauri/target/release/bundle/dmg/
# - Linux: src-tauri/target/release/bundle/appimage/
```

### 仅前端开发

```bash
# Vite 开发服务器（Port 1620）
npm run dev

# 前端生产构建
npm run build

# 预览生产构建
npm run preview
```

## 🔄 工作流

### 1. 欢迎页面 - 文件夹选择
用户通过系统对话框选择包含 NEF 文件的文件夹

### 2. 后端处理流水线
```
扫描文件夹 → NEF TIFF IFD 解析 → 提取嵌入 JPEG 预览
    ↓
缩略图生成 (Lanczos3缩放)  →  计算 pHash 感知哈希
    ↓
相似度分组 (时间+相似度双条件)  →  合焦评分
    ↓
返回分组结果与元数据
```

### 3. 主窗口 - 画布浏览与交互
- **瀑布流布局**：3 列自适应，分组标题、智能间距
- **选中交互**：点击图片 toggle 选中，蓝色边框标记
- **缩放与平移**：滚轮缩放、拖拽移动、快捷键导航
- **批量导出**：选中后点击导出按钮，异步复制 RAW 文件

## ⌨️ 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| **W** | 上一分组 |
| **S** | 下一分组 |
| **Ctrl + O** | 打开文件夹 |
| **Ctrl + E** | 导出选中图片（规划中） |

## 🎨 UI 特性

### 主题系统
- **Light 模式**：清爽设计，适合日间使用
- **Dark 模式**：护眼深色，减少眼睛疲劳
- **CSS 变量**：100+ 自定义属性，全局一致性管理

### 响应式布局
- 动态 3 列瀑布流（视口宽度自适应）
- 浮动控制面板（可拖拽、固定位置）
- 分组列表侧边栏（可折叠）

### 动画与反馈
- 图片加载动画（淡入）
- 主题切换过渡（200ms）
- Toast 通知（成功、错误、信息）
- 进度对话框（处理中显示）

## 📊 性能指标

| 场景 | 目标 | 状态 |
|------|------|------|
| 100 张图片 | 60fps | ✅ |
| 1000 张图片 | 60fps 虚拟化 | ⏳ 优化中 |
| 元数据提取 | <1s (100张) | ✅ |
| pHash 计算 | <10ms/张 | ✅ |
| NEF 解析 | <50ms/张 | ✅ |

## 🧪 测试

### Rust 单元测试
```bash
cd src-tauri
cargo test
```

**覆盖范围**：
- EXIF 元数据解析（8+ 测试）
- pHash 算法（4+ 测试）
- NEF TIFF 解析（5+ 测试）
- 分组逻辑（3+ 测试）
- 合焦评分（2+ 测试）

### 前端单元测试
```bash
npm run test
```

**覆盖范围**：
- Zustand Store（缩放、主题、选中状态）
- 工具函数（布局、格式化、视口计算）
- React Hooks（图片加载、键盘交互）

**目标覆盖率**：≥ 80%

## 🗂️ 配置文件

### Tauri 配置 (src-tauri/tauri.conf.json)
- **应用标识**：com.bulbul.app
- **版本**：0.2.0
- **多窗口**：welcome (600×450) + main (全屏)
- **插件**：对话框、文件系统、启动器

### 构建优化 (Cargo.toml)
```toml
[profile.dev.package."*"]
opt-level = 2              # Debug 模式下依赖库优化

[profile.release]
lto = "thin"               # 链接时优化
opt-level = 3              # 最高优化级别
```

## 🔍 关键实现细节

### EXIF Orientation 处理（纵向图片识别）
当 EXIF Orientation 标记为 5、6、7、8（表示需要旋转 ±90°）时，后端自动调整显示尺寸的宽高。

```rust
// src-tauri/src/core/metadata.rs
if matches!(orientation, 5 | 6 | 7 | 8) {
    meta.image_width = Some(height);
    meta.image_height = Some(width);
}
```

### pHash 算法流程
1. JPEG 加载 → 转灰度
2. Lanczos3 缩放到 9×8
3. 2D DCT-II 变换
4. 取 8×8 低频系数（排除 DC）
5. 与均值比较 → 64-bit hash

### 缩放与主题持久化
- **存储位置**：`$APPDATA/bulbul/settings.json`
- **防抖延迟**：500ms（连续快速变更只保存最后一次）
- **初始化**：应用启动时通过 `initSettings()` 从磁盘加载

## 🐛 故障排除

### Windows 开发环境问题
确保已安装 Microsoft Visual C++ Build Tools 或 Visual Studio Community。

### Rust 编译缓慢
启用增量编译：
```bash
export CARGO_BUILD_PIPELINED_COMPILATION=true
```

### Tauri 开发窗口不显示
检查 `src-tauri/tauri.conf.json` 中窗口的 `visible: false` 设置，需要等待前端初始化完成。

## 📝 代码规范

- **TypeScript**：严格模式，完整类型注解
- **Rust**：遵循 Clippy lint，无 unsafe 代码（除必要）
- **React**：函数组件 + Hooks，Zustand 状态管理
- **测试**：单元测试覆盖率 ≥ 80%

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启 Pull Request

## 📄 许可证

MIT

**Bulbul** - 为摄影师设计，由现代化技术驱动 🚀
