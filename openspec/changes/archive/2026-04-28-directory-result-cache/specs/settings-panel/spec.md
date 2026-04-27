## MODIFIED Requirements

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
