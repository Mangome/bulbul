## ADDED Requirements

### Requirement: fileService 文件服务
系统 SHALL 提供 `services/fileService.ts` 模块，封装文件相关 IPC 调用：selectFolder()（调用 select_folder 命令）、getFolderInfo(path)（调用 get_folder_info 命令）、scanRawFiles(path)（调用 scan_raw_files 命令）。所有方法 SHALL 返回 Promise，使用 `@tauri-apps/api/core` 的 `invoke` 函数。

#### Scenario: selectFolder 调用
- **WHEN** 调用 fileService.selectFolder()
- **THEN** SHALL 调用 invoke('select_folder') 并返回文件夹路径或 null

#### Scenario: getFolderInfo 调用
- **WHEN** 调用 fileService.getFolderInfo("/path")
- **THEN** SHALL 调用 invoke('get_folder_info', { path: "/path" }) 并返回 FolderInfo 对象

### Requirement: processService 处理服务
系统 SHALL 提供 `services/processService.ts` 模块，封装处理流水线 IPC 调用：processFolder(folderPath, options?)（调用 process_folder 命令）、cancelProcessing()（调用 cancel_processing 命令）。SHALL 提供事件监听方法：onProgress(callback)、onCompleted(callback)、onFailed(callback)，使用 `@tauri-apps/api/event` 的 `listen` 函数。

#### Scenario: processFolder 默认参数
- **WHEN** 调用 processService.processFolder("/path") 不传 options
- **THEN** SHALL 调用 invoke 时 similarityThreshold 默认为 90.0，timeGapSeconds 默认为 10

#### Scenario: onProgress 事件监听
- **WHEN** 调用 processService.onProgress(callback)
- **THEN** SHALL 注册 'processing-progress' 事件监听器

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
