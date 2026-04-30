## MODIFIED Requirements

### Requirement: 所有核心接口定义
types/index.ts SHALL 导出以下接口/类型：ImageMetadata、GroupData、GroupResult、PerformanceMetrics、ProcessingState（字符串字面量联合类型）、ProcessingProgress、FolderInfo、ScanResult、ExportResult。

FolderInfo 的 `rawCount` 字段 SHALL 重命名为 `imageCount`，对应 Rust 端 `FolderInfo.image_count`。ImageMetadata 的注释 SHALL 从"RAW 图像元数据"更新为"图像元数据"。

#### Scenario: FolderInfo 字段更新
- **WHEN** 查看 TypeScript 的 FolderInfo 接口
- **THEN** SHALL 包含 `imageCount: number` 字段（替代原 `rawCount: number`），对应 Rust 的 `image_count`

#### Scenario: ImageMetadata 注释更新
- **WHEN** 查看 TypeScript 的 ImageMetadata 接口注释
- **THEN** SHALL 显示"图像元数据"（替代原"RAW 图像元数据"）

#### Scenario: ProcessingState 类型
- **WHEN** 使用 ProcessingState 类型
- **THEN** SHALL 为字符串字面量联合类型 "idle" | "scanning" | "processing" | "analyzing" | "grouping" | "completed" | "cancelling" | "cancelled" | "error"

#### Scenario: GroupData 字段完整
- **WHEN** 查看 TypeScript 的 GroupData 接口
- **THEN** SHALL 包含 id (number)、name (string)、imageCount (number)、avgSimilarity (number)、representativeHash (string)、pictureHashes (string[])、pictureNames (string[])、picturePaths (string[])

#### Scenario: 类型导出可用
- **WHEN** 其他模块导入 `import { ImageMetadata, GroupData } from '../types'`
- **THEN** SHALL 成功导入，TypeScript 编译无类型错误
