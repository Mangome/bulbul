## MODIFIED Requirements

### Requirement: SessionState 结构

SessionState SHALL 包含以下新增字段用于支持 pHash 缓存和分组结果存储：
- `phash_cache: HashMap<String, u64>` — 文件路径 hash → pHash 值的缓存映射
- `group_result: Option<GroupResult>` — 分组结果（已存在，无需新增）

完整字段列表：
- `current_folder: Option<PathBuf>`
- `filename_hash_map: HashMap<String, String>`
- `hash_filename_map: HashMap<String, String>`
- `hash_path_map: HashMap<String, PathBuf>`
- `metadata_cache: HashMap<String, ImageMetadata>`
- `phash_cache: HashMap<String, u64>` — **新增**
- `group_result: Option<GroupResult>`
- `processing_state: ProcessingState`
- `cancel_flag: Arc<AtomicBool>`
- `cache_dir: PathBuf`

#### Scenario: pHash 缓存读写

- **WHEN** 计算完一张图片的 pHash 后
- **THEN** 存入 `phash_cache`，key 为文件路径 hash，value 为 u64 pHash 值

#### Scenario: 重置清空 pHash 缓存

- **WHEN** 调用 `reset()` 方法
- **THEN** `phash_cache` 被清空，`group_result` 被重置为 None
