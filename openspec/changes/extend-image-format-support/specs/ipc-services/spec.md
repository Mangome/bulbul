## MODIFIED Requirements

### Requirement: fileService 文件服务
系统 SHALL 提供 `services/fileService.ts` 模块，封装文件相关 IPC 调用：selectFolder()（调用 select_folder 命令）、getFolderInfo(path)（调用 get_folder_info 命令）、scanImageFiles(path)（调用 scan_image_files 命令，替代原 scanRawFiles）。所有方法 SHALL 返回 Promise，使用 `@tauri-apps/api/core` 的 `invoke` 函数。

#### Scenario: selectFolder 调用
- **WHEN** 调用 fileService.selectFolder()
- **THEN** SHALL 调用 invoke('select_folder') 并返回文件夹路径或 null

#### Scenario: getFolderInfo 调用
- **WHEN** 调用 fileService.getFolderInfo("/path")
- **THEN** SHALL 调用 invoke('get_folder_info', { path: "/path" }) 并返回 FolderInfo 对象（含 imageCount 字段）

#### Scenario: scanImageFiles 调用
- **WHEN** 调用 fileService.scanImageFiles("/path")
- **THEN** SHALL 调用 invoke('scan_image_files', { path: "/path" }) 并返回 ScanResult

#### Scenario: scanRawFiles 兼容
- **WHEN** 旧代码仍调用 fileService.scanRawFiles
- **THEN** SHALL 正常工作（函数重命名，行为一致）
