## ADDED Requirements

### Requirement: Rust 模块目录结构
系统 SHALL 在 `src-tauri/src/` 下建立 `commands/`、`core/`、`models/`、`state/`、`utils/` 五个模块目录，每个目录包含 `mod.rs` 入口文件并在 `lib.rs` 中注册。

#### Scenario: 模块目录存在且可编译
- **WHEN** 执行 `cargo build`
- **THEN** `commands/mod.rs`、`core/mod.rs`、`models/mod.rs`、`state/mod.rs`、`utils/mod.rs` 全部编译通过，无 dead_code 以外的警告

#### Scenario: lib.rs 注册所有模块
- **WHEN** 查看 `lib.rs` 源码
- **THEN** SHALL 包含 `mod commands;`、`mod core;`、`mod models;`、`mod state;`、`mod utils;` 五个模块声明
