## 1. 依赖安装与项目配置

- [x] 1.1 安装 PixiJS v8 依赖：`npm install pixi.js@^8`
- [x] 1.2 验证 Tauri dev 环境下 PixiJS 可正常初始化 WebGL 上下文

## 2. Rust 图片服务命令

- [x] 2.1 实现 `get_image_url` 命令：根据 hash + size 拼接缓存路径，验证文件存在后返回绝对路径
- [x] 2.2 实现 `get_metadata` 命令：从 SessionState.metadata_cache 查询单个 hash 的 ImageMetadata
- [x] 2.3 实现 `get_batch_metadata` 命令：批量查询多个 hash 的 ImageMetadata，忽略不存在的 hash
- [x] 2.4 在 `lib.rs` 中注册新增的 image commands
- [x] 2.5 编写 `image_commands` 单元测试（正常路径 + 文件不存在 + hash 不存在）

## 3. 瀑布流布局引擎

- [x] 3.1 创建 `src/utils/layout.ts`：定义 LayoutConfig、LayoutItem 接口
- [x] 3.2 实现 `computeWaterfallLayout` 函数：接收 GroupData[] + imageDimensions Map + viewportWidth，输出 LayoutItem[] + totalHeight
- [x] 3.3 处理缺失尺寸信息的回退逻辑（默认 3:2 比例）
- [x] 3.4 处理空分组场景（仅预留标题区域）
- [x] 3.5 编写布局算法单元测试：标准布局、最短列分配、不同宽高比、空分组、单列退化、列宽计算边界

## 4. 纹理 LRU 管理与图片加载

- [x] 4.1 创建 `src/hooks/useImageLoader.ts`：实现 TextureLRUCache 类（容量 300，淘汰时调用 texture.destroy()）
- [x] 4.2 实现异步纹理加载逻辑：调用 imageService.getImageUrl 获取 asset:// URL → Assets.load 加载为纹理
- [x] 4.3 实现分级加载逻辑：根据 zoomLevel 选择 thumbnail（<50%）或 medium（≥50%）
- [x] 4.4 实现缩放阈值切换：跨越 50% 时重新加载视口内图片的对应分辨率纹理
- [x] 4.5 编写 TextureLRUCache 单元测试：容量限制、LRU 淘汰顺序、缓存命中、重复加载

## 5. 视口裁剪引擎

- [x] 5.1 实现 `getVisibleItems` 函数：基于 LayoutItem[] 和视口矩形（含 50% 高度缓冲区）计算可见元素集合
- [x] 5.2 对 LayoutItem 按 Y 坐标排序，使用二分搜索优化视口裁剪查询
- [x] 5.3 实现增量 diff 算法：对比前后帧的可见集合，输出 enter/leave 两个列表
- [x] 5.4 编写视口裁剪单元测试：视口内/外判定、缓冲区边界、极端缩放、滚动增量更新

## 6. 波点底纹背景

- [x] 6.1 创建 `src/components/canvas/DotBackground.ts`：生成波点纹理（主波点 3px/rgba(225,225,225,0.47) + 小波点 2px/rgba(200,200,200,0.31)，间距 20px）
- [x] 6.2 使用 TilingSprite 实现无限重复，固定在视口坐标系（不受 ContentLayer 缩放影响）
- [x] 6.3 响应窗口 resize 更新 TilingSprite 尺寸

## 7. PixiJS 无限画布核心

- [x] 7.1 创建 `src/components/canvas/InfiniteCanvas.tsx`：React 组件，管理 PixiJS Application 生命周期（init / resize / destroy）
- [x] 7.2 搭建 Stage 层级结构：BackgroundLayer（DotBackground）+ ContentLayer（Container）
- [x] 7.3 实现滚轮缩放：wheel 事件 → 锚点缩放算法 → 更新 ContentLayer scale + position → 同步 useCanvasStore
- [x] 7.4 实现拖拽平移：pointerdown/pointermove/pointerup → 5px 死区 → 更新 ContentLayer position
- [x] 7.5 实现视口矩形实时追踪：缩放/平移后计算 ContentLayer 坐标系中的可见矩形
- [x] 7.6 集成视口裁剪引擎：视口变化时执行增量 diff，调用 enter/leave 回调管理 CanvasImageItem

## 8. 图片项渲染

- [x] 8.1 创建 `src/components/canvas/CanvasImageItem.ts`：PixiJS Container 封装（非 React 组件），包含占位色块 + Sprite + 信息覆盖层
- [x] 8.2 实现占位色块渲染：纹理加载前显示 #E5E7EB 灰色矩形
- [x] 8.3 实现纹理加载后的 Sprite 替换：异步加载完成 → 创建 Sprite → 隐藏占位色块
- [x] 8.4 创建 `src/components/canvas/ImageInfoOverlay.ts`：底部渐变 + 文件名 Badge + 参数 Badge（光圈/快门/ISO/焦段）
- [x] 8.5 实现信息覆盖层缩放阈值隐藏：zoomLevel < 30% 时设置 visible = false
- [x] 8.6 实现分组标题文本渲染：在每个分组区域顶部显示"分组 N（M 张）"文本

## 9. 画布集成与 MainPage 更新

- [x] 9.1 更新 `MainPage.tsx`：替换占位文本为 InfiniteCanvas 组件
- [x] 9.2 处理完成后批量获取 ImageMetadata（调用 getBatchMetadata），计算布局
- [x] 9.3 将 GroupResult + LayoutItem[] + imageDimensions 传入 InfiniteCanvas
- [x] 9.4 增强 `useCanvasStore`：增加 viewportRect 字段，连接画布的实时视口信息
- [x] 9.5 端到端验证：选择文件夹 → 处理完成 → 画布展示分组图片 → 缩放/平移流畅

## 10. 前端单元测试补充

- [x] 10.1 布局算法测试覆盖率 ≥ 85%
- [x] 10.2 TextureLRUCache 测试覆盖率 ≥ 85%
- [x] 10.3 视口裁剪引擎测试覆盖率 ≥ 85%
- [x] 10.4 useCanvasStore 测试：缩放范围限制、视口矩形更新
