## Purpose

管理图片处理结果和目录分组的磁盘缓存，支持基于文件指纹的缓存验证，避免重复处理未变更的文件。

## Requirements

### Requirement: 图片结果缓存数据模型

系统 SHALL 定义 `ImageResultCache` 结构体，包含以下字段：hash (String)、filename (String)、file_path (String)、metadata (ImageMetadata)、phash (Option<u64>)、medium_path (String)、thumbnail_path (String)、fingerprint (FileFingerprint)。所有字段 SHALL 支持 `Serialize`/`Deserialize`。

`FileFingerprint` 结构体 SHALL 包含：modified (f64, Unix 时间戳秒)、size (u64, 文件大小)。

#### Scenario: ImageResultCache 序列化

- **WHEN** 将 `ImageResultCache` 序列化为 JSON
- **THEN** 所有字段（含嵌套的 `ImageMetadata`、`DetectionBox`、`FocusScoringMethod`）正确序列化，可被反序列化还原

#### Scenario: FileFingerprint 存储

- **WHEN** 处理一张 NEF 文件获得结果
- **THEN** `fingerprint.modified` SHALL 为该文件的 mtime（Unix 时间戳秒），`fingerprint.size` SHALL 为该文件的字节大小

### Requirement: 目录分组缓存数据模型

系统 SHALL 定义 `DirectoryGroupCache` 结构体，包含以下字段：folder_path (String)、file_hashes (Vec<String>)、group_result (GroupResult)、image_infos (Vec<ImageInfoWithPhash>)、cached_at (String, ISO 8601)。

#### Scenario: DirectoryGroupCache 序列化

- **WHEN** 将 `DirectoryGroupCache` 序列化为 JSON
- **THEN** `image_infos` 中的 `NaiveDateTime` SHALL 序列化为 `"%Y-%m-%dT%H:%M:%S"` 格式字符串

#### Scenario: DirectoryGroupCache 反序列化

- **WHEN** 从 JSON 反序列化 `DirectoryGroupCache`
- **THEN** `image_infos` 中的时间字符串 SHALL 正确还原为 `NaiveDateTime`

### Requirement: 图片结果缓存读写

系统 SHALL 提供以下异步函数操作 `$CACHE_DIR/bulbul/result/{hash}.json`：
- `load_image_result(cache_dir, hash)` → `Option<ImageResultCache>`
- `save_image_result(cache_dir, hash, &ImageResultCache)` → `Result<(), AppError>`
- `delete_image_result(cache_dir, hash)` → `Result<(), AppError>`

#### Scenario: 保存并加载图片结果

- **WHEN** 调用 `save_image_result` 保存一张图片的结果后调用 `load_image_result` 读取
- **THEN** SHALL 返回与保存时相同的数据

#### Scenario: 加载不存在的缓存

- **WHEN** 调用 `load_image_result` 读取一个不存在的 hash
- **THEN** SHALL 返回 None

#### Scenario: 保存失败

- **WHEN** 磁盘空间不足或权限不足导致 `save_image_result` 写入失败
- **THEN** SHALL 返回 `AppError::CacheError`

### Requirement: 目录分组缓存读写

系统 SHALL 提供以下异步函数操作 `$CACHE_DIR/bulbul/groups/{MD5(dir_path)}.json`：
- `load_group_cache(cache_dir, folder_path)` → `Option<DirectoryGroupCache>`
- `save_group_cache(cache_dir, folder_path, &DirectoryGroupCache)` → `Result<(), AppError>`
- `delete_group_cache(cache_dir, folder_path)` → `Result<(), AppError>`

缓存文件名 SHALL 使用 `compute_path_hash` 计算目录路径的 MD5。

#### Scenario: 保存并加载目录缓存

- **WHEN** 调用 `save_group_cache` 保存后调用 `load_group_cache` 读取
- **THEN** SHALL 返回与保存时相同的数据

#### Scenario: 加载不存在的目录缓存

- **WHEN** 调用 `load_group_cache` 读取一个未缓存的目录
- **THEN** SHALL 返回 None

### Requirement: 缓存指纹验证

系统 SHALL 在加载图片结果缓存时验证 `FileFingerprint`：比较缓存中存储的 `modified` 和 `size` 与当前实际文件的 mtime 和 size。任一不匹配 SHALL 视为缓存失效。

#### Scenario: 指纹完全匹配

- **WHEN** 缓存中的 modified 和 size 与当前文件一致
- **THEN** SHALL 视为缓存有效

#### Scenario: mtime 变化

- **WHEN** 当前文件的 mtime 与缓存中存储的 modified 不同
- **THEN** SHALL 视为缓存失效

#### Scenario: 文件大小变化

- **WHEN** 当前文件的 size 与缓存中存储的 size 不同
- **THEN** SHALL 视为缓存失效

#### Scenario: 文件不存在

- **WHEN** 缓存中记录的文件路径对应的文件已不存在
- **THEN** SHALL 视为缓存失效

### Requirement: 结果缓存清理

系统 SHALL 提供 `clear_all_result_caches(cache_dir)` 异步函数，删除 `result/` 和 `groups/` 子目录下所有文件，保留目录结构。

#### Scenario: 删除所有结果缓存

- **WHEN** 调用 `clear_all_result_caches`
- **THEN** SHALL 删除 `result/` 和 `groups/` 下所有文件，目录本身保留

#### Scenario: 结果缓存大小统计

- **WHEN** 调用 `get_result_cache_size(cache_dir)`
- **THEN** SHALL 遍历 `result/` 和 `groups/` 目录，返回 (总字节数, 文件数量)

### Requirement: ImageInfoWithPhash 序列化支持

`ImageInfoWithPhash` 结构体 SHALL 派生 `Serialize`/`Deserialize`，其中 `NaiveDateTime` 字段 SHALL 序列化为 `"%Y-%m-%dT%H:%M:%S"` 格式字符串。

#### Scenario: ImageInfoWithPhash 序列化往返

- **WHEN** 将 `ImageInfoWithPhash` 序列化为 JSON 后反序列化
- **THEN** 所有字段（含 capture_time）SHALL 与原始值一致
