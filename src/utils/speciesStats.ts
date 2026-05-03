// ============================================================
// 鸟种统计聚合工具
//
// 从 ImageMetadata 集合中聚合鸟种识别结果，
// 置信度阈值与 drawDetectionOverlay 的 SPECIES_HIGH_CONFIDENCE 一致。
// ============================================================

import type { ImageMetadata, SpeciesStat } from '../types';

/** 鸟种高置信阈值，与 drawDetectionOverlay 保持一致 */
const SPECIES_HIGH_CONFIDENCE = 0.85;

/** "未识别"条目的固定名称 */
export const UNIDENTIFIED_KEY = '未识别';

export interface SpeciesAggregateResult {
  /** 已识别鸟种列表（按数量降序） */
  species: SpeciesStat[];
  /** 未识别图片数（有检测框但无 >= 85% 置信度物种） */
  unidentifiedCount: number;
  /** 有检测结果的图片总数 */
  detectedImageCount: number;
  /** 已识别鸟种数 */
  speciesCount: number;
}

/**
 * 从 metadataMap 中聚合鸟种统计。
 *
 * 规则：
 * - speciesConfidence >= 0.85 的 bbox 视为可信识别
 * - 同一张图多个 bbox 识别为同一种鸟只计一次（Set 去重）
 * - 有检测框但无 >= 85% 置信度物种的图片计入"未识别"
 */
export function aggregateSpecies(
  metadataMap: Map<string, ImageMetadata>,
): SpeciesAggregateResult {
  const speciesCount = new Map<string, number>();
  let unidentifiedCount = 0;
  let detectedImageCount = 0;

  for (const meta of metadataMap.values()) {
    const bboxes = meta.detectionBboxes;
    if (!bboxes || bboxes.length === 0) continue;

    detectedImageCount++;

    const identified = new Set<string>();
    for (const bbox of bboxes) {
      if (
        bbox.speciesName
        && bbox.speciesConfidence !== undefined
        && bbox.speciesConfidence >= SPECIES_HIGH_CONFIDENCE
      ) {
        identified.add(bbox.speciesName);
      }
    }

    if (identified.size === 0) {
      unidentifiedCount++;
    } else {
      for (const name of identified) {
        speciesCount.set(name, (speciesCount.get(name) ?? 0) + 1);
      }
    }
  }

  const species: SpeciesStat[] = [...speciesCount.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    species,
    unidentifiedCount,
    detectedImageCount,
    speciesCount: species.length,
  };
}
