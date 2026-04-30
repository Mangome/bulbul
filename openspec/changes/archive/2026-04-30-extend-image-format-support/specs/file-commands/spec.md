## MODIFIED Requirements

### Requirement: get_folder_info 命令
系统 SHALL 提供 `get_folder_info` IPC 命令，接受文件夹路径参数，返回 `FolderInfo`（path, name, file_count, image_count）。image_count SHALL 统计所有支持的图片格式文件数量（RAW + JPEG + PNG + TIFF + WebP，大小写不敏感），使用 `is_supported_extension()` 函数判断。

#### Scenario: 有效文件夹路径（多格式）
- **WHEN** 调用 `get_folder_info` 传入一个存在的文件夹路径，该文件夹包含 3 个 .nef 文件、2 个 .cr2 文件、1 个 .arw 文件和 4 个 .jpg 文件
- **THEN** 返回 FolderInfo 其中 file_count 为 10，image_count 为 10

#### Scenario: 仅包含非 RAW 图片
- **WHEN** 调用 `get_folder_info` 传入仅包含 .jpg 和 .png 文件的文件夹
- **THEN** image_count SHALL 反映所有支持的图片文件数量

#### Scenario: 不存在的路径
- **WHEN** 调用 `get_folder_info` 传入一个不存在的路径
- **THEN** SHALL 返回错误

### Requirement: scan_image_files 命令
系统 SHALL 提供 `scan_image_files` IPC 命令（替代原 `scan_raw_files`），接受文件夹路径参数，扫描该目录下所有支持的图片格式文件（大小写不敏感，非递归），返回文件路径列表。扫描完成后 SHALL 更新 `SessionState.current_folder`。

#### Scenario: 扫描包含多格式图片的文件夹
- **WHEN** 调用 `scan_image_files` 传入包含 `.nef`、`.CR2`、`.jpg`、`.PNG` 文件的文件夹路径
- **THEN** 返回所有支持格式文件的绝对路径列表，大小写不敏感匹配，同时更新 SessionState.current_folder

#### Scenario: 空文件夹
- **WHEN** 调用 `scan_image_files` 传入一个不包含支持格式文件的文件夹
- **THEN** 返回空列表

#### Scenario: 混合 RAW 和非 RAW 文件
- **WHEN** 调用 `scan_image_files` 传入包含 .nef、.jpg、.png、.webp 文件的文件夹
- **THEN** SHALL 返回所有四种格式的文件路径

### Requirement: process_folder 命令
系统 SHALL 提供 `process_folder` IPC 命令，接受文件夹路径和可选参数（similarity_threshold、time_gap_seconds），执行完整的处理流水线：扫描所有支持的图片格式文件（RAW + JPEG + PNG + TIFF + WebP） → 并发处理每个文件 → 更新 SessionState 映射 → 推送进度事件 → 返回处理结果。

#### Scenario: 成功处理包含多格式的文件夹
- **WHEN** 调用 `process_folder` 传入包含 5 个 RAW 文件和 3 个 JPEG 文件的文件夹路径
- **THEN** SHALL 处理全部 8 个文件，返回包含 8 条记录的结果

#### Scenario: 空文件夹处理
- **WHEN** 调用 `process_folder` 传入不包含支持格式文件的文件夹
- **THEN** SHALL 返回空结果（total_images = 0），不报错
