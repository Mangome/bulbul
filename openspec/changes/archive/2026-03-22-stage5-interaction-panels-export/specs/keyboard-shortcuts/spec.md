## ADDED Requirements

### Requirement: W/S 键分组切换

useKeyboard hook SHALL 监听 W 和 S 键，触发 AppStore 的 `navigateGroup('prev')` 和 `navigateGroup('next')`，支持首尾循环。

#### Scenario: 按 S 键切换到下一组

- **WHEN** 当前选中分组 id=2（共 5 组），用户按下 S 键
- **THEN** selectedGroupId 变为 3，画布滚动到分组 3 的位置

#### Scenario: 按 W 键切换到上一组

- **WHEN** 当前选中分组 id=2，用户按下 W 键
- **THEN** selectedGroupId 变为 1，画布滚动到分组 1 的位置

#### Scenario: 末尾循环到开头

- **WHEN** 当前选中最后一个分组，用户按下 S 键
- **THEN** selectedGroupId 变为第一个分组的 id

#### Scenario: 开头循环到末尾

- **WHEN** 当前选中第一个分组，用户按下 W 键
- **THEN** selectedGroupId 变为最后一个分组的 id

### Requirement: Ctrl 组合键

useKeyboard hook SHALL 监听以下 Ctrl 组合键：

- `Ctrl+O`: 打开文件夹选择对话框
- `Ctrl+E`: 导出选中图片
- `Ctrl+A`: 全选当前分组内所有图片
- `Ctrl+0`: 适应窗口
- `Ctrl+1`: 实际大小（100%）
- `Ctrl+=`: 放大
- `Ctrl+-`: 缩小

#### Scenario: Ctrl+A 全选当前分组

- **WHEN** selectedGroupId 指向一个有 10 张图片的分组，用户按 Ctrl+A
- **THEN** 该分组的 10 张图片全部加入 SelectionStore 的 selectedHashes

#### Scenario: Ctrl+E 触发导出

- **WHEN** SelectionStore 中有选中图片，用户按 Ctrl+E
- **THEN** 弹出系统文件夹选择对话框，流程与点击导出按钮一致

#### Scenario: Ctrl+O 打开文件夹

- **WHEN** 用户按 Ctrl+O
- **THEN** 调用 fileService 打开文件夹选择对话框

### Requirement: Escape 键多功能

useKeyboard hook SHALL 监听 Escape 键，根据当前状态执行不同操作。

#### Scenario: 有选中图片时清除选择

- **WHEN** SelectionStore 中有选中图片，用户按 Escape
- **THEN** 调用 clearSelection 清除所有选中

#### Scenario: 处理中按 Escape 取消

- **WHEN** processingState 为 processing/scanning/analyzing/grouping，用户按 Escape
- **THEN** 触发取消处理流程

### Requirement: 输入框聚焦时跳过快捷键

当 document.activeElement 为 input、textarea 或 contenteditable 元素时，useKeyboard hook SHALL 跳过所有快捷键处理。

#### Scenario: 输入框聚焦时按 W

- **WHEN** 用户在输入框中聚焦，按下 W 键
- **THEN** 不触发分组切换，字符正常输入到输入框
