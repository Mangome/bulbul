## ADDED Requirements

### Requirement: Rust 端批量文件复制

`export_images` 命令 SHALL 接收 `hashes: Vec<String>` 和 `target_dir: String`，从 SessionState 的 `hash_path_map` 获取原始 RAW 文件路径，逐个通过 `tokio::fs::copy` 复制到目标目录，返回 `ExportResult { success_count, total_count, failed_files }`。

#### Scenario: 正常导出全部成功

- **WHEN** 传入 5 个有效 hash 和可写的目标目录
- **THEN** 5 个 RAW 文件被复制到目标目录，返回 `{ success_count: 5, total_count: 5, failed_files: [] }`

#### Scenario: 部分文件复制失败

- **WHEN** 传入 5 个 hash，其中 1 个源文件不存在
- **THEN** 成功复制 4 个文件，失败的文件名记录到 failed_files，返回 `{ success_count: 4, total_count: 5, failed_files: ["missing.nef"] }`

#### Scenario: 目标目录不存在时自动创建

- **WHEN** 指定的目标目录不存在
- **THEN** 自动创建目标目录（含父目录），然后执行复制

### Requirement: 文件名冲突重命名

当目标目录中已存在同名文件时，系统 SHALL 自动追加 `_1`、`_2` 等后缀进行重命名。

#### Scenario: 同名文件重命名

- **WHEN** 目标目录已存在 `IMG_001.nef`，导出的文件也叫 `IMG_001.nef`
- **THEN** 导出文件重命名为 `IMG_001_1.nef`

#### Scenario: 多次冲突递增后缀

- **WHEN** 目标目录已存在 `IMG_001.nef` 和 `IMG_001_1.nef`
- **THEN** 导出文件重命名为 `IMG_001_2.nef`

### Requirement: 导出进度推送

Rust 端在每复制完一个文件后 SHALL emit `export-progress` 事件，payload 为 `{ current: usize, total: usize }`。

#### Scenario: 导出进度事件推送

- **WHEN** 正在导出第 3 个文件（共 5 个）
- **THEN** emit `export-progress` 事件，payload 为 `{ current: 3, total: 5 }`

### Requirement: 选择导出目录

`select_export_dir` 命令 SHALL 调用 `tauri-plugin-dialog` 打开文件夹选择对话框，返回用户选择的路径或 `None`（取消）。

#### Scenario: 用户选择目录

- **WHEN** 用户在对话框中选择了 `D:\exports` 目录
- **THEN** 命令返回 `Some("D:\\exports")`

#### Scenario: 用户取消选择

- **WHEN** 用户在对话框中点击取消
- **THEN** 命令返回 `None`

### Requirement: 前端导出流程编排

前端 SHALL 编排完整的导出流程：获取选中 hashes → 调用 `select_export_dir` → 调用 `export_images` → 监听进度 → 展示结果。

#### Scenario: 完整导出流程

- **WHEN** 用户触发导出（按钮或 Ctrl+E），且 SelectionStore 有选中图片
- **THEN** 依次执行：打开目录选择对话框 → 用户选择目录 → 调用 Rust 导出 → 展示导出结果（成功数/失败数）→ 清除选中状态

#### Scenario: 用户取消目录选择

- **WHEN** 用户在目录选择对话框中点击取消
- **THEN** 导出流程终止，不执行复制操作
