## Purpose

提供右侧滑出设置面板，集中管理分组参数、外观设置、版本更新和缓存管理功能。

## Requirements

### Requirement: 设置面板 UI 组件
系统 SHALL 提供右侧滑出设置面板（`SettingsPanel`），宽度 320px，包含四个区域：分组参数、外观设置、版本更新、缓存管理。面板 SHALL 使用毛玻璃背景和 `motion/react` 滑入动画。

#### Scenario: 打开设置面板
- **WHEN** 用户点击 TopNavBar 的设置按钮（齿轮图标）
- **THEN** 设置面板 SHALL 从右侧滑入显示，同时显示半透明遮罩

#### Scenario: 关闭设置面板
- **WHEN** 用户点击遮罩区域或面板内关闭按钮
- **THEN** 设置面板 SHALL 滑出隐藏

#### Scenario: 面板打开时自动查询缓存大小
- **WHEN** 设置面板打开
- **THEN** SHALL 自动调用 `getCacheSize()` 获取最新缓存信息并显示

### Requirement: 设置面板分组参数区域
设置面板 SHALL 包含分组参数区域，提供相似度阈值滑块（50-100, step 1）和时间间隔滑块（1-120s, step 1），每个滑块旁显示当前数值。

#### Scenario: 滑块显示当前值
- **WHEN** 设置面板打开
- **THEN** 相似度滑块 SHALL 显示当前 `similarityThreshold` 值，时间间隔滑块 SHALL 显示当前 `timeGapSeconds` 值

#### Scenario: 调整参数触发重分组
- **WHEN** 用户调整滑块值（500ms 防抖后）且当前有分组数据
- **THEN** SHALL 调用 `regroupWith(similarityThreshold, timeGapSeconds)` 重新分组

#### Scenario: 无分组数据时调整参数
- **WHEN** 用户调整滑块值但当前无分组数据
- **THEN** 值 SHALL 保存但不触发重分组

### Requirement: 设置面板外观设置区域
设置面板 SHALL 包含外观设置区域，提供检测框覆盖层开关（toggle）。

#### Scenario: 切换检测框开关
- **WHEN** 用户点击检测框开关
- **THEN** `showDetectionOverlay` 状态 SHALL 切换，画布检测框可见性立即变化

#### Scenario: 开关反映当前状态
- **WHEN** 设置面板打开且 `showDetectionOverlay` 为 `true`
- **THEN** 检测框开关 SHALL 显示为开启状态

### Requirement: 设置面板版本更新区域
设置面板 SHALL 提供版本更新区域，显示当前应用版本，并提供检查更新入口；当检测到新版本时，该区域 SHALL 显示最新版本号、更新说明和安装动作。

#### Scenario: 显示当前版本
- **WHEN** 用户打开设置面板
- **THEN** 版本更新区域 SHALL 显示当前安装的应用版本号

#### Scenario: 检测到新版本
- **WHEN** 用户点击“检查更新”且存在适配当前平台的新版本
- **THEN** 版本更新区域 SHALL 显示新版本号、更新说明和“下载并安装”按钮

#### Scenario: 当前无可用更新
- **WHEN** 用户点击“检查更新”且不存在新版本
- **THEN** 版本更新区域 SHALL 显示“当前已是最新版本”之类的明确反馈

### Requirement: 更新动作状态反馈
设置面板的版本更新区域 SHALL 对检查中、下载中、安装中和失败状态提供明确反馈，并在异步操作进行期间禁用重复点击。

#### Scenario: 检查更新进行中
- **WHEN** 系统正在请求更新元数据
- **THEN** “检查更新”按钮 SHALL 显示进行中状态并禁止重复点击

#### Scenario: 下载或安装进行中
- **WHEN** 系统正在下载或安装更新
- **THEN** 版本更新区域 SHALL 显示当前状态，并禁止再次触发检查或安装

#### Scenario: 更新失败
- **WHEN** 检查或安装过程失败
- **THEN** 版本更新区域 SHALL 显示失败反馈，并允许用户稍后重试

### Requirement: 设置面板缓存管理区域
设置面板 SHALL 包含缓存管理区域，显示缓存目录路径、磁盘占用大小（人类可读格式）和文件数量，提供刷新按钮、清理按钮和**重新处理按钮**。

#### Scenario: 显示缓存信息
- **WHEN** 缓存信息查询成功
- **THEN** SHALL 显示缓存目录路径、格式化后的大小（如 "128.5 MB"）和文件数量

#### Scenario: 刷新缓存信息
- **WHEN** 用户点击刷新按钮
- **THEN** SHALL 重新调用 `getCacheSize()` 更新显示

#### Scenario: 缓存信息查询失败
- **WHEN** `getCacheSize()` 调用失败
- **THEN** SHALL 显示 "无法获取缓存信息" 错误提示

#### Scenario: 重新处理按钮

- **WHEN** 用户点击「重新处理」按钮
- **THEN** SHALL 调用 `processFolder(currentFolder, { forceRefresh: true })` 强制跳过缓存重新处理当前目录

#### Scenario: 重新处理按钮禁用

- **WHEN** 没有打开的目录或正在处理中
- **THEN** 「重新处理」按钮 SHALL 显示为禁用状态

### Requirement: TopNavBar 设置按钮
TopNavBar 右区 SHALL 新增设置按钮（齿轮图标 IconSettings），点击打开设置面板。

#### Scenario: 点击设置按钮
- **WHEN** 用户点击 TopNavBar 的设置按钮
- **THEN** 设置面板 SHALL 打开

#### Scenario: 设置按钮无禁用状态
- **WHEN** 应用处于任何处理状态
- **THEN** 设置按钮 SHALL 始终可点击
