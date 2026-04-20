## MODIFIED Requirements

### Requirement: get_folder_info 命令
系统 SHALL 提供 `get_folder_info` IPC 命令，接受文件夹路径参数，返回 `FolderInfo`（path, name, file_count, raw_count）。raw_count SHALL 统计所有支持的 RAW 扩展名文件数量（大小写不敏感），使用 `is_raw_extension()` 函数判断。

#### Scenario: 有效文件夹路径（多格式）
- **WHEN** 调用 `get_folder_info` 传入一个存在的文件夹路径，该文件夹包含 3 个 .nef 文件、2 个 .cr2 文件、1 个 .arw 文件和 4 个 .jpg 文件
- **THEN** 返回 FolderInfo 其中 file_count 为 10，raw_count 为 6

#### Scenario: 不存在的路径
- **WHEN** 调用 `get_folder_info` 传入一个不存在的路径
- **THEN** SHALL 返回错误

### Requirement: scan_raw_files 命令
系统 SHALL 提供 `scan_raw_files` IPC 命令，接受文件夹路径参数，扫描该目录下所有支持的 RAW 格式文件（大小写不敏感，非递归），返回文件路径列表。扫描完成后 SHALL 更新 `SessionState.current_folder`。

#### Scenario: 扫描包含多格式 RAW 文件的文件夹
- **WHEN** 调用 `scan_raw_files` 传入包含 `.nef`、`.CR2`、`.Arw` 文件的文件夹路径
- **THEN** 返回所有 RAW 文件的绝对路径列表，大小写不敏感匹配，同时更新 SessionState.current_folder

#### Scenario: 空文件夹
- **WHEN** 调用 `scan_raw_files` 传入一个不包含 RAW 文件的文件夹
- **THEN** 返回空列表
