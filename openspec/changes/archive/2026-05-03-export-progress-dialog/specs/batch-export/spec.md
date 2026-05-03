## MODIFIED Requirements

### Requirement: 导出进度推送

Rust 端在每复制完一个文件后 SHALL emit `export-progress` 事件，payload 为 `{ current: usize, total: usize, current_file: Option<String>, elapsed_ms: f64 }`。

#### Scenario: 导出进度事件推送

- **WHEN** 正在导出第 3 个文件（共 5 个），文件名为 `IMG_003.nef`，已耗时 8000ms
- **THEN** emit `export-progress` 事件，payload 为 `{ current: 3, total: 5, current_file: Some("IMG_003.nef"), elapsed_ms: 8000.0 }`

#### Scenario: hash 未找到源文件时的进度事件

- **WHEN** 正在导出第 2 个文件（共 5 个），但该 hash 未找到源文件，已耗时 5000ms
- **THEN** emit `export-progress` 事件，payload 为 `{ current: 2, total: 5, current_file: None, elapsed_ms: 5000.0 }`
