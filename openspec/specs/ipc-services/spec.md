## ADDED Requirements

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

### Requirement: processService 处理服务
系统 SHALL 提供 `services/processService.ts` 模块，封装处理流水线 IPC 调用：processFolder(folderPath, options?)（调用 process_folder 命令，返回 `Promise<GroupResult>`）、cancelProcessing()（调用 cancel_processing 命令）。SHALL 提供事件监听方法：onProgress(callback)、onCompleted(callback)、onFailed(callback)，使用 `@tauri-apps/api/event` 的 `listen` 函数。

#### Scenario: processFolder 返回 GroupResult
- **WHEN** 调用 processService.processFolder("/path")
- **THEN** 返回 `Promise<GroupResult>`，包含 `groups`、`totalImages`、`totalGroups`、`processedFiles`、`performance`

#### Scenario: processFolder 默认参数
- **WHEN** 调用 processService.processFolder("/path") 不传 options
- **THEN** SHALL 调用 invoke 时 similarityThreshold 默认为 90.0，timeGapSeconds 默认为 10

#### Scenario: onProgress 事件监听
- **WHEN** 调用 processService.onProgress(callback)
- **THEN** SHALL 注册 'processing-progress' 事件监听器

#### Scenario: 进度事件包含完整阶段和时间信息
- **WHEN** 接收 `onProgress` 回调的 `ProcessingProgress` 对象
- **THEN** `progress.state` 覆盖完整流水线阶段（scanning/processing/analyzing/grouping/completed/cancelling/cancelled/error），`elapsedMs` 和 `estimatedRemainingMs` 字段可用

#### Scenario: 完成事件携带 GroupResult
- **WHEN** 流水线处理完成
- **THEN** `onCompleted` 回调被调用，参数为完整的 `GroupResult` 对象

### Requirement: imageService 图片服务
系统 SHALL 提供 `services/imageService.ts` 模块，封装图片查询 IPC 调用：getImageUrl(hash, size)（调用 get_image_url 命令 + convertFileSrc 转换）、getMetadata(hash)、getBatchMetadata(hashes)。

#### Scenario: getImageUrl 路径转换
- **WHEN** 调用 imageService.getImageUrl("abc", "thumbnail")
- **THEN** SHALL 先调用 invoke 获取文件路径，再通过 convertFileSrc 转为 asset:// URL

### Requirement: exportService 导出服务
系统 SHALL 提供 `services/exportService.ts` 模块，封装导出 IPC 调用：selectExportDir()（调用 select_export_dir 命令）、exportImages(hashes, targetDir)（调用 export_images 命令）。

#### Scenario: exportImages 调用
- **WHEN** 调用 exportService.exportImages(["hash1", "hash2"], "/export/dir")
- **THEN** SHALL 调用 invoke('export_images', { hashes: ["hash1", "hash2"], targetDir: "/export/dir" })
