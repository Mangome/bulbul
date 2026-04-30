## ADDED Requirements

### Requirement: TypeScript 类型与 Rust 模型对齐
系统 SHALL 在 `types/index.ts` 中定义与 Rust 数据模型完全对应的 TypeScript 类型。字段命名 SHALL 使用 camelCase（对应 Rust 的 snake_case，通过 serde rename_all 保证 JSON 一致性）。

#### Scenario: ImageMetadata 类型完整
- **WHEN** 查看 TypeScript 的 ImageMetadata 接口
- **THEN** SHALL 包含与 Rust ImageMetadata 完全对应的字段：captureTime、modifyTime、cameraMake、cameraModel 等，所有可选字段使用 `T | null` 类型

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
