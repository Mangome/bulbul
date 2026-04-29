## MODIFIED Requirements

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

## ADDED Requirements

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