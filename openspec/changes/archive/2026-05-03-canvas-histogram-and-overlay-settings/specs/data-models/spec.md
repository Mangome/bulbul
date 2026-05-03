## MODIFIED Requirements

### Requirement: ImageMetadata 扩展
`ImageMetadata` 结构 SHALL 新增三个字段：`histogram_r`（R 通道直方图）、`histogram_g`（G 通道直方图）、`histogram_b`（B 通道直方图），均为 `Vec<u32>`（长度 256 或 0）。三个字段均为 `#[serde(default)]`，支持向后兼容。

#### Scenario: 新增直方图字段
- **WHEN** 图片完成处理
- **THEN** `histogram_r`、`histogram_g`、`histogram_b` 各包含 256 个 u32 元素

#### Scenario: 向后兼容旧数据
- **WHEN** 读取由旧系统生成的元数据（无直方图字段）
- **THEN** `histogram_r`、`histogram_g`、`histogram_b` SHALL 默认为空 Vec

#### Scenario: TypeScript 类型对应
- **WHEN** 前端从后端获取 ImageMetadata JSON
- **THEN** TypeScript 接口 SHALL 包含 `histogramR: number[]`、`histogramG: number[]`、`histogramB: number[]` 字段（camelCase）
