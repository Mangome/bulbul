## Purpose

提供右侧滑出设置面板，集中管理分组参数、外观设置和缓存管理功能。

## Requirements

### Requirement: 设置面板 UI 组件
系统 SHALL 提供右侧滑出设置面板（`SettingsPanel`），宽度 320px，包含三个区域：分组参数、外观设置、缓存管理。面板 SHALL 使用毛玻璃背景和 `motion/react` 滑入动画。

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

### Requirement: 设置面板缓存管理区域
设置面板 SHALL 包含缓存管理区域，显示缓存目录路径、磁盘占用大小（人类可读格式）和文件数量，提供刷新按钮和清理按钮。

#### Scenario: 显示缓存信息
- **WHEN** 缓存信息查询成功
- **THEN** SHALL 显示缓存目录路径、格式化后的大小（如 "128.5 MB"）和文件数量

#### Scenario: 刷新缓存信息
- **WHEN** 用户点击刷新按钮
- **THEN** SHALL 重新调用 `getCacheSize()` 更新显示

#### Scenario: 缓存信息查询失败
- **WHEN** `getCacheSize()` 调用失败
- **THEN** SHALL 显示 "无法获取缓存信息" 错误提示

### Requirement: TopNavBar 设置按钮
TopNavBar 右区 SHALL 新增设置按钮（齿轮图标 IconSettings），点击打开设置面板。

#### Scenario: 点击设置按钮
- **WHEN** 用户点击 TopNavBar 的设置按钮
- **THEN** 设置面板 SHALL 打开

#### Scenario: 设置按钮无禁用状态
- **WHEN** 应用处于任何处理状态
- **THEN** 设置按钮 SHALL 始终可点击
