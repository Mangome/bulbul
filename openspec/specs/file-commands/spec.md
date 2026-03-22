## ADDED Requirements

### Requirement: select_folder 命令
系统 SHALL 提供 `select_folder` IPC 命令，调用 Tauri dialog 插件弹出系统文件夹选择对话框，返回用户选择的文件夹路径（`Option<String>`）。用户取消选择时返回 `None`。

#### Scenario: 用户选择文件夹
- **WHEN** 前端调用 `invoke('select_folder')`，用户在系统对话框中选择了一个文件夹
- **THEN** 命令返回该文件夹的绝对路径字符串

#### Scenario: 用户取消选择
- **WHEN** 前端调用 `invoke('select_folder')`，用户点击取消
- **THEN** 命令返回 `None`

### Requirement: get_folder_info 命令
系统 SHALL 提供 `get_folder_info` IPC 命令，接受文件夹路径参数，返回 `FolderInfo`（path, name, file_count, raw_count）。raw_count SHALL 统计 `.nef` 扩展名文件数量（大小写不敏感）。

#### Scenario: 有效文件夹路径
- **WHEN** 调用 `get_folder_info` 传入一个存在的文件夹路径，该文件夹包含 5 个 .nef 文件和 3 个 .jpg 文件
- **THEN** 返回 FolderInfo 其中 file_count 为 8，raw_count 为 5

#### Scenario: 不存在的路径
- **WHEN** 调用 `get_folder_info` 传入一个不存在的路径
- **THEN** SHALL 返回错误

### Requirement: scan_raw_files 命令
系统 SHALL 提供 `scan_raw_files` IPC 命令，接受文件夹路径参数，扫描该目录下所有 `.nef` 文件（大小写不敏感，非递归），返回文件路径列表。

#### Scenario: 扫描包含 NEF 文件的文件夹
- **WHEN** 调用 `scan_raw_files` 传入包含 `.nef` 和 `.NEF` 文件的文件夹路径
- **THEN** 返回所有 NEF 文件的绝对路径列表，大小写不敏感匹配

#### Scenario: 空文件夹
- **WHEN** 调用 `scan_raw_files` 传入一个不包含 NEF 文件的文件夹
- **THEN** 返回空列表
