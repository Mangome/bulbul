## Context

Bulbul 当前仅支持 Nikon NEF 格式，解析器 (`nef_parser.rs`) 已实现完整的 TIFF/EP IFD 遍历 + 嵌入 JPEG 提取。该解析器的核心逻辑（`extract_largest_jpeg()`）是通用的 TIFF IFD BFS 遍历，对其他基于 TIFF/EP 的 RAW 格式（CR2/ARW/DNG/ORF/RW2/PEF）直接适用。

代码中存在 3 处 `.nef` 扩展名硬编码扫描、1 处导出 fallback 文件名硬编码、1 处错误类型命名 NEF 专属、1 处前端 UI 文案 NEF 专属。

架构上，`RawExtractor` trait 已预留多格式扩展点，但仅有 `NefExtractor` 一个实现。`get_extractor()` 工厂函数仅匹配 `"nef"`。

## Goals / Non-Goals

**Goals:**
- 支持 9 种主流 RAW 格式：NEF/CR2/CR3/ARW/DNG/RAF/ORF/RW2/PEF
- TIFF/EP 格式（6 种）复用现有解析逻辑，零额外代码量提取 JPEG
- Fuji RAF 和 Canon CR3 分别实现专用解析器
- 统一扩展名匹配，消除所有 `.nef` 硬编码
- 保持现有缓存机制（基于路径 hash）和导出逻辑不变

**Non-Goals:**
- 不支持 Phase One IIQ、Sigma X3F 等低市占格式
- 不实现 RAW 像素数据解码（仅提取嵌入 JPEG 预览）
- 不修改前端架构或增加格式选择 UI
- 不引入 libraw/libraw-rs 等重量级外部库
- 不实现格式自动检测（依赖文件扩展名）

## Decisions

### D1: 模块重命名 `nef_parser` → `raw_parser`

**决策**: 将 `nef_parser.rs` 重命名为 `raw_parser.rs`，模块内新增所有格式 Extractor。

**替代方案**: 保留 `nef_parser.rs` 名，另建 `cr3_parser.rs` / `raf_parser.rs` 独立模块。
**理由**: 现有 `nef_parser.rs` 已包含通用的 TIFF 解析基础设施（`parse_tiff_header`、`parse_ifd`、`extract_largest_jpeg`），这些是所有 TIFF/EP 格式共享的。独立模块会导致代码重复或跨模块引用私有函数。集中管理更符合 SOLID 的单一职责——"RAW 格式解析"是一个职责。

### D2: TIFF/EP Extractor 复用 `extract_largest_jpeg()`

**决策**: CR2/ARW/DNG/ORF/RW2/PEF 的 Extractor 实现均直接调用现有的 `extract_largest_jpeg()` 函数，不写任何格式特有逻辑。

**替代方案**: 为每个格式实现定制的 JPEG 提取逻辑。
**理由**: 这些格式的 JPEG 嵌入方式与 NEF 相同（TIFF IFD tag 0x0201/0x0202），实测验证通用提取器有效。定制逻辑增加维护成本无收益。

### D3: CR3 使用 `mp4parse` crate 解析 ISOBMFF 容器

**决策**: 引入 `mp4parse` crate 解析 CR3 的 ISO Base Media File Format 容器，定位 `CRAW` box 中的 JPEG 预览。

**替代方案**: 手写 ISOBMFF box 遍历器。
**理由**: ISOBMFF 容器格式复杂（box 嵌套、fullbox、版本号），手写解析器容易出错且维护成本高。`mp4parse` 是 Mozilla 维护的成熟 crate，已在 Firefox 中使用，支持 CR3 所需的 box 类型。

### D4: RAF 解析器手写偏移表解析

**决策**: Fuji RAF 解析器手写解析文件头偏移表（前 148 字节固定结构），定位 JPEG 偏移和长度。

**替代方案**: 引入 `raf` 专用 crate。
**理由**: RAF 文件头结构简单明确（magic + version + JPEG offset/length + CFA offset/length），手写约 50 行即可，不值得引入外部依赖。

### D5: Exif 头部读取策略按格式区分

**决策**: 在 `RawExtractor` trait 中新增 `exif_header_size()` 方法，返回该格式的 Exif 头部大小。TIFF/EP 格式返回 64KB，CR3 返回 0（需全量读取），RAF 返回 64KB。

**替代方案**: 统一使用全量读取。
**理由**: 64KB 头部读取是缓存命中时的关键优化（速度提升 ~500x），不能放弃。但 CR3 的 Exif 存储在 ISOBMFF box 中，不在文件头部，无法用固定偏移读取。

### D6: `SUPPORTED_RAW_EXTENSIONS` 常量集中定义

**决策**: 在 `raw_parser.rs` 中定义 `pub const SUPPORTED_RAW_EXTENSIONS: &[&str]`，所有扩展名检查统一引用。

**替代方案**: 从 `get_extractor()` 动态收集各 Extractor 的 `supported_extensions()`。
**理由**: 常量定义简洁直观，扫描函数只需做扩展名匹配，不需要构造 Extractor 实例。动态收集需要遍历所有 Extractor，增加不必要的运行时开销。

## Risks / Trade-offs

- **[CR3 解析正确性]** → 使用 `mp4parse` 降低手写出错风险，但需用真实 CR3 文件验证提取的 JPEG 完整性。Mitigation: 编写集成测试用真实 CR3 文件验证。
- **[CR3 新增依赖]** → `mp4parse` 增加 ~50KB 编译体积。Mitigation: 该 crate 是 Mozilla 维护的轻量级库，无传递依赖，体积可控。
- **[TIFF/EP 格式差异]** → 部分 TIFF/EP 格式可能有私有 SubIFD 结构导致通用解析器遗漏 JPEG。Mitigation: 通用解析器已做 BFS 遍历所有 SubIFD，且选最大 JPEG 策略覆盖多数情况。若遇特定厂商的边界情况，可后续添加格式特化逻辑。
- **[Exif 头部 64KB 假设]** → 非 TIFF/EP 格式可能不适用。Mitigation: D5 的 `exif_header_size()` 方法提供按格式区分的回退机制，读取失败时自动回退全量读取。
- **[重命名 `NefParseError`]** → 属于破坏性变更，所有引用处需同步更新。Mitigation: 使用 `replace_all` 批量替换，编译错误可立即发现遗漏。
