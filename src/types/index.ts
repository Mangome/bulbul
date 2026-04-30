// ============================================================
// Bulbul 前端类型定义
// 与 Rust 数据模型对齐，字段名使用 camelCase
// ============================================================

/** 检测框坐标和置信度 */
export interface DetectionBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
  /** 鸟种名称（预留，当前检测器不支持，始终为 undefined） */
  speciesName?: string;
  /** 鸟种分类置信度（预留，当前检测器不支持，始终为 undefined） */
  speciesConfidence?: number;
}

/** 合焦评分方法 */
export type FocusScoringMethod = "FullImage" | "BirdRegion" | "Undetected";

/** 图像元数据 */
export interface ImageMetadata {
  // 时间信息
  captureTime: string | null;
  modifyTime: string | null;

  // 相机信息
  cameraMake: string | null;
  cameraModel: string | null;
  serialNumber: string | null;

  // 镜头信息
  lensModel: string | null;
  lensSerial: string | null;
  focalLength: number | null;
  /** 35mm 等效焦段（EXIF 或根据裁切系数计算） */
  focalLength35mm: number | null;
  /** 裁切系数（从 EXIF 推导或从相机型号推算） */
  cropFactor: number | null;

  // 曝光参数
  fNumber: number | null;
  exposureTime: string | null;
  isoSpeed: number | null;

  // 闪光灯
  flashFired: boolean | null;
  flashMode: string | null;

  // 测光与曝光模式
  exposureMode: string | null;
  meteringMode: string | null;
  exposureCompensation: number | null;

  // 白平衡
  whiteBalance: string | null;
  colorSpace: string | null;

  // 图像尺寸
  imageWidth: number | null;
  imageHeight: number | null;
  orientation: number | null;

  // 文件信息
  fileSize: number | null;
  compression: string | null;

  // 合焦程度评分（1-5 星）
  focusScore: number | null;

  // 鸟类检测框（相对坐标 [0, 1]）
  detectionBboxes: DetectionBox[];

  // 合焦评分方法标记
  focusScoreMethod: FocusScoringMethod | null;
}

/** 单个分组的数据 */
export interface GroupData {
  id: number;
  name: string;
  imageCount: number;
  avgSimilarity: number;
  representativeHash: string;
  pictureHashes: string[];
  pictureNames: string[];
  picturePaths: string[];
}

/** 分组处理的完整结果 */
export interface GroupResult {
  groups: GroupData[];
  totalImages: number;
  totalGroups: number;
  processedFiles: number;
  performance: PerformanceMetrics;
}

/** 性能指标 */
export interface PerformanceMetrics {
  totalTimeMs: number;
  scanTimeMs: number;
  processTimeMs: number;
  similarityTimeMs: number;
  groupingTimeMs: number;
}

/** 处理流水线状态 */
export type ProcessingState =
  | "idle"
  | "scanning"
  | "processing"
  | "analyzing"
  | "grouping"
  | "focus_scoring"
  | "completed"
  | "cancelling"
  | "cancelled"
  | "error";

/** 处理进度信息 */
export interface ProcessingProgress {
  state: ProcessingState;
  current: number;
  total: number;
  progressPercent: number;
  message: string | null;
  currentFile: string | null;
  elapsedMs: number | null;
  estimatedRemainingMs: number | null;
}

/** 文件夹信息 */
export interface FolderInfo {
  path: string;
  name: string;
  fileCount: number;
  imageCount: number;
}

/** 扫描结果 */
export interface ScanResult {
  files: string[];
  count: number;
}

/** 导出结果 */
export interface ExportResult {
  exportedCount: number;
  totalCount: number;
  targetDir: string;
  failedFiles: string[];
}
