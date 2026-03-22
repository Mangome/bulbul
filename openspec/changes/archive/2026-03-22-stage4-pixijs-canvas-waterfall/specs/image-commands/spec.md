## ADDED Requirements

### Requirement: get_image_url 命令
Rust 端 SHALL 提供 `get_image_url` 命令，根据 hash 和 size 返回缓存图片的本地文件路径。

#### Scenario: 获取 medium 图片路径
- **WHEN** 前端调用 `get_image_url` 传入 hash 和 size="medium"
- **THEN** 系统 SHALL 返回 `{cache_dir}/medium/{hash}.jpg` 的绝对路径

#### Scenario: 获取 thumbnail 图片路径
- **WHEN** 前端调用 `get_image_url` 传入 hash 和 size="thumbnail"
- **THEN** 系统 SHALL 返回 `{cache_dir}/thumbnail/{hash}.jpg` 的绝对路径

#### Scenario: 缓存文件不存在
- **WHEN** 请求的 hash 对应的缓存文件不存在
- **THEN** 系统 SHALL 返回错误信息

### Requirement: get_metadata 命令
Rust 端 SHALL 提供 `get_metadata` 命令，根据 hash 返回缓存的 ImageMetadata。

#### Scenario: 获取已缓存的元数据
- **WHEN** 前端调用 `get_metadata` 传入已处理图片的 hash
- **THEN** 系统 SHALL 从 SessionState.metadata_cache 返回对应的 ImageMetadata

#### Scenario: hash 不存在
- **WHEN** 前端调用 `get_metadata` 传入未知 hash
- **THEN** 系统 SHALL 返回错误信息"元数据未找到"

### Requirement: get_batch_metadata 命令
Rust 端 SHALL 提供 `get_batch_metadata` 命令，批量获取多个 hash 的 ImageMetadata。

#### Scenario: 批量获取
- **WHEN** 前端调用 `get_batch_metadata` 传入 hash 数组
- **THEN** 系统 SHALL 返回 HashMap<String, ImageMetadata>，包含所有匹配的条目

#### Scenario: 部分 hash 不存在
- **WHEN** 传入的 hash 数组中部分 hash 不在缓存中
- **THEN** 系统 SHALL 返回存在的条目，忽略不存在的 hash（不报错）
