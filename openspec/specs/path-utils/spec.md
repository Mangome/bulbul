## Requirements

### Requirement: 路径规范化
系统 SHALL 提供函数将文件路径规范化为绝对路径，消除符号链接、`..`、`.` 等相对路径成分。在 Windows 上 SHALL 使用统一的路径分隔符。

#### Scenario: 相对路径规范化
- **WHEN** 传入 `./photos/../photos/IMG_001.nef`
- **THEN** SHALL 返回该文件的规范化绝对路径

#### Scenario: 已是绝对路径
- **WHEN** 传入 `D:\photos\IMG_001.nef`
- **THEN** SHALL 返回相同的规范化路径

### Requirement: MD5 路径哈希
系统 SHALL 提供函数计算文件路径的 MD5 哈希值，先将路径规范化为绝对路径的 UTF-8 字符串，再计算 MD5，返回 32 字符十六进制小写字符串。

#### Scenario: 路径哈希确定性
- **WHEN** 对同一文件路径两次调用哈希函数
- **THEN** SHALL 返回完全相同的 32 字符十六进制字符串

#### Scenario: 不同路径不同哈希
- **WHEN** 对两个不同文件路径调用哈希函数
- **THEN** SHALL 返回不同的哈希值

#### Scenario: 路径规范化一致性
- **WHEN** 对 `D:\photos\IMG_001.nef` 和 `D:\photos\.\IMG_001.nef` 调用哈希函数
- **THEN** SHALL 返回相同的哈希值（因为规范化后是同一路径）

### Requirement: 缓存基础目录获取
系统 SHALL 提供函数获取应用缓存基础目录 `{app_cache_dir}/bulbul/`，通过 Tauri 的路径 API 或运行时参数获取系统缓存目录。

#### Scenario: 获取缓存基础目录
- **WHEN** 调用缓存目录获取函数
- **THEN** SHALL 返回平台对应的缓存路径（Windows: `C:\Users\{user}\AppData\Local\bulbul\`）
