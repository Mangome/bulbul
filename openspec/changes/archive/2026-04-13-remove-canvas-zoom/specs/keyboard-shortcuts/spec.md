## MODIFIED Requirements

### Requirement: Ctrl 组合键

useKeyboard hook SHALL 监听以下 Ctrl 组合键：

- `Ctrl+O`: 打开文件夹选择对话框
- `Ctrl+E`: 导出选中图片
- `Ctrl+A`: 全选当前分组内所有图片

#### Scenario: Ctrl+A 全选当前分组

- **WHEN** selectedGroupId 指向一个有 10 张图片的分组，用户按 Ctrl+A
- **THEN** 该分组的 10 张图片全部加入 SelectionStore 的 selectedHashes

#### Scenario: Ctrl+E 触发导出

- **WHEN** SelectionStore 中有选中图片，用户按 Ctrl+E
- **THEN** 弹出系统文件夹选择对话框，流程与点击导出按钮一致

#### Scenario: Ctrl+O 打开文件夹

- **WHEN** 用户按 Ctrl+O
- **THEN** 调用 fileService 打开文件夹选择对话框

## REMOVED Requirements

### Requirement: Ctrl+0/1/+/- 缩放快捷键
**Reason**: 画布不再支持缩放功能
**Migration**: Ctrl+0 (fitToWindow)、Ctrl+1 (resetZoom)、Ctrl+= (zoomIn)、Ctrl+- (zoomOut) 全部移除
