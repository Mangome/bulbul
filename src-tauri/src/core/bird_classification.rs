//! 鸟种分类模块
//!
//! 基于 ResNet34 全球鸟类分类 ONNX 模型（bird_classifier.onnx, INT8 QDQ 量化）。
//!
//! 处理流程：
//! 1. 加载 ONNX 分类模型和物种数据库（首次缓存到内存）
//! 2. 根据检测框裁剪图片中的鸟类区域
//! 3. Resize 到 224×224 + ImageNet 标准归一化（mean/std）
//! 4. ResNet34/MetaFGNet 推理获得 10,964 类 logits
//! 5. Softmax 转概率 + argmax 对应物种
//! 6. 从物种数据库查找中文名/英文名
//!
//! 模型输入: `images` [1, 3, 224, 224] float32（NCHW，ImageNet 归一化）
//! 模型输出: `output0` [1, 11000] float32（原始 logits，需手动 softmax）
//!
//! 训练数据: DIB-10K 全球鸟类数据集（10,964 种）
//! 替代原 YOLOv8s-cls 373 类中国鸟类模型以实现全球鸟种覆盖。
//! 旧模型归档于 temp/legacy_models/species_database_v2_cn_373.json。
//!
//! 设计原则：
//! - Best-effort：分类失败不影响主流水线，仅 log warn
//! - 物种名称优先中文名，无中文名时 fallback 英文名

use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use crate::core::bird_detection::DetectionBox;
use crate::models::AppError;

/// 分类器输入尺寸
const CLASSIFIER_INPUT_SIZE: u32 = 224;

/// 鸟种最低置信度阈值（低于此值不标注物种名称）
///
/// 在 10,964 类全球鸟种模型下，类似别的概率被摊薄，置信度天然分散，
/// 因此阈值从 0.25 降低到 0.10，避免过滤掉正确识别。
const SPECIES_CONFIDENCE_THRESHOLD: f32 = 0.10;

/// 分类器推理线程数
const CLASSIFIER_INTRA_THREADS: usize = 2;

/// 物种数据库条目
#[derive(Debug, Clone, Deserialize)]
struct SpeciesEntry {
    /// 类别 ID（1-indexed，对应 ONNX 输出 logit 索引 class_id - 1）
    class_id: usize,
    /// 学名（用于调试，不参与显示名称选择）
    #[allow(dead_code)]
    scientific_name: String,
    /// 英文俗名
    common_name_en: String,
    /// 中文俗名（理论上 373 种全部有中文名；若因数据源缺失则为 null）
    common_name_zh: Option<String>,
    /// 目（用于调试）
    #[allow(dead_code)]
    order: String,
    /// 科（用于调试）
    #[allow(dead_code)]
    family: String,
    /// 属（用于调试）
    #[allow(dead_code)]
    genus: String,
}

impl SpeciesEntry {
    /// 显示名称：优先中文名，fallback 英文名
    fn display_name(&self) -> &str {
        self.common_name_zh
            .as_deref()
            .filter(|s| !s.is_empty())
            .unwrap_or(&self.common_name_en)
    }
}

// ─── ONNX 模型与物种数据库缓存 ────────────────────────────────────

lazy_static::lazy_static! {
    static ref CLASSIFIER_SESSION: Mutex<Option<ort::session::Session>> = Mutex::new(None);
    static ref SPECIES_DATABASE: Mutex<Option<Vec<SpeciesEntry>>> = Mutex::new(None);
}

/// 加载分类器 ONNX 模型到内存缓存
fn load_classifier_model(model_path: &Path) -> Result<(), AppError> {
    let mut session = CLASSIFIER_SESSION.lock().map_err(|_| {
        AppError::ClassificationFailed("分类器模型缓存锁定失败".to_string())
    })?;

    if session.is_some() {
        return Ok(());
    }

    let new_session = ort::session::Session::builder()
        .map_err(|e| AppError::ClassificationFailed(format!("Session 构建失败: {}", e)))?
        .with_intra_threads(CLASSIFIER_INTRA_THREADS)
        .map_err(|e| AppError::ClassificationFailed(format!("线程配置失败: {}", e)))?
        .commit_from_file(model_path)
        .map_err(|e| AppError::ClassificationFailed(format!("分类器模型加载失败: {}", e)))?;

    *session = Some(new_session);
    Ok(())
}

/// 加载物种数据库到内存缓存
fn load_species_database(db_path: &Path) -> Result<(), AppError> {
    let mut db = SPECIES_DATABASE.lock().map_err(|_| {
        AppError::ClassificationFailed("物种数据库缓存锁定失败".to_string())
    })?;

    if db.is_some() {
        return Ok(());
    }

    let content = std::fs::read_to_string(db_path).map_err(|e| {
        AppError::ClassificationFailed(format!("物种数据库读取失败: {}", e))
    })?;

    let entries: Vec<SpeciesEntry> = serde_json::from_str(&content).map_err(|e| {
        AppError::ClassificationFailed(format!("物种数据库解析失败: {}", e))
    })?;

    log::info!("物种数据库已加载: {} 个物种", entries.len());
    *db = Some(entries);
    Ok(())
}

// ─── 图像预处理 ────────────────────────────────────

/// 分类器裁剪区域向外扩展的比例
///
/// 检测框紧贴鸟体时会丢失背景上下文（生境信息对鸟种判断很有帮助），
/// 向外扩展 25% 可以保留更多环境线索，显著提升分类准确率。
const CROP_PADDING_RATIO: f32 = 0.25;

/// 裁剪图片中的检测框区域
///
/// bbox 坐标为 [0, 1] 归一化坐标，裁剪前先向外扩展 `CROP_PADDING_RATIO`
/// 比例的 padding（受图片边界约束），以保留背景上下文信息。
fn crop_bbox_region(
    img: &image::DynamicImage,
    bbox: &DetectionBox,
) -> image::DynamicImage {
    let (img_w, img_h) = (img.width() as f32, img.height() as f32);

    // bbox 像素尺寸
    let bbox_pw = (bbox.x2 - bbox.x1) * img_w;
    let bbox_ph = (bbox.y2 - bbox.y1) * img_h;

    // 向外扩展 padding，clamp 到图片边界
    let pad_x = bbox_pw * CROP_PADDING_RATIO;
    let pad_y = bbox_ph * CROP_PADDING_RATIO;

    let x1 = (((bbox.x1 * img_w) - pad_x).floor().max(0.0) as u32).min(img.width());
    let y1 = (((bbox.y1 * img_h) - pad_y).floor().max(0.0) as u32).min(img.height());
    let x2 = (((bbox.x2 * img_w) + pad_x).ceil().min(img_w) as u32).min(img.width());
    let y2 = (((bbox.y2 * img_h) + pad_y).ceil().min(img_h) as u32).min(img.height());

    let crop_w = x2.saturating_sub(x1);
    let crop_h = y2.saturating_sub(y1);

    if crop_w == 0 || crop_h == 0 {
        // 退化为全图
        return img.clone();
    }

    img.crop_imm(x1, y1, crop_w, crop_h)
}

/// 将 RGB 图片转换为 NCHW f32 张量，使用 ImageNet 标准预处理
///
/// 预处理流程与 ResNet34/MetaFGNet 训练时一致：
/// 1. 直接 Resize 到 224×224（不保持宽高比）
/// 2. RGB 像素值除以 255.0
/// 3. 减去 ImageNet 均值 [0.485, 0.456, 0.406]
/// 4. 除以 ImageNet 标准差 [0.229, 0.224, 0.225]
/// 5. HWC → CHW 通道排列
///
/// 返回 (shape, flat_data)，shape = [1, 3, 224, 224]
fn image_to_classifier_input(
    img: &image::DynamicImage,
) -> (Vec<i64>, Vec<f32>) {
    // 1. 直接 Resize 到 224×224
    let resized = img.resize_exact(
        CLASSIFIER_INPUT_SIZE,
        CLASSIFIER_INPUT_SIZE,
        image::imageops::FilterType::Lanczos3,
    );

    // ImageNet 归一化参数
    let mean = [0.485f32, 0.456, 0.406];
    let std = [0.229f32, 0.224, 0.225];

    // 2-5. 归一化 + HWC→CHW
    let rgb = resized.to_rgb8();
    let (w, h) = (rgb.width() as usize, rgb.height() as usize);
    let mut data = vec![0.0f32; 3 * h * w];

    for y in 0..h {
        for x in 0..w {
            let pixel = rgb.get_pixel(x as u32, y as u32);
            data[0 * h * w + y * w + x] = (pixel[0] as f32 / 255.0 - mean[0]) / std[0]; // R
            data[1 * h * w + y * w + x] = (pixel[1] as f32 / 255.0 - mean[1]) / std[1]; // G
            data[2 * h * w + y * w + x] = (pixel[2] as f32 / 255.0 - mean[2]) / std[2]; // B
        }
    }

    (vec![1, 3, h as i64, w as i64], data)
}

// ─── 推理与后处理 ────────────────────────────────────

/// 对 logits 做 softmax，返回概率分布
fn softmax(logits: &[f32]) -> Vec<f32> {
    let max_logit = logits.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
    let exps: Vec<f32> = logits.iter().map(|&x| (x - max_logit).exp()).collect();
    let sum: f32 = exps.iter().sum();
    if sum == 0.0 {
        return vec![0.0; logits.len()];
    }
    exps.iter().map(|&e| e / sum).collect()
}

/// 对单个裁剪区域执行分类推理，返回完整概率分布
///
/// 返回 `(probs, best_idx, best_conf)`，probs 为 softmax 后的概率向量。
/// 用于分组内多帧概率平均融合，比单帧 argmax 投票更准确。
fn classify_crop_with_probs(
    crop: &image::DynamicImage,
) -> Option<(Vec<f32>, usize, f32)> {
    let mut session_guard = CLASSIFIER_SESSION.lock().ok()?;
    let session = session_guard.as_mut()?;

    let (shape, data) = image_to_classifier_input(crop);

    let input_tensor = ort::value::Tensor::from_array((shape, data)).ok()?;

    let outputs = session.run(ort::inputs!["images" => input_tensor]).ok()?;

    let output = outputs.get("output0")?;
    let (_out_shape, out_data) = output.try_extract_tensor::<f32>().ok()?;

    // 新模型输出原始 logits，需 softmax 转概率
    let logits: Vec<f32> = out_data.to_vec();
    let probs = softmax(&logits);

    let (best_idx, &best_prob) = probs
        .iter()
        .enumerate()
        .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))?;

    Some((probs, best_idx, best_prob))
}

/// 对单个裁剪区域执行分类推理（便捷包装，仅返回最佳结果）
///
/// 返回 (class_id_0indexed, confidence)，失败返回 None
fn classify_crop(
    crop: &image::DynamicImage,
) -> Option<(usize, f32)> {
    classify_crop_with_probs(crop).map(|(_, idx, prob)| (idx, prob))
}

/// 根据类别索引查找物种显示名称
///
/// class_id 在数据库中为 1-indexed，ONNX 输出索引为 0-indexed
/// 数据库按 class_id 升序排列，class_id = idx + 1，可直接索引访问
fn lookup_species_name(class_idx_0: usize) -> Option<String> {
    let db = SPECIES_DATABASE.lock().ok()?;
    let db = db.as_ref()?;

    // 直接索引：class_id = idx + 1，数据库按 class_id 严格升序
    if class_idx_0 >= db.len() {
        log::warn!(
            "类别索引 {} 超出物种数据库范围 (len={})",
            class_idx_0,
            db.len()
        );
        return None;
    }
    let entry = &db[class_idx_0];
    debug_assert_eq!(entry.class_id, class_idx_0 + 1, "class_id 应为 idx+1");
    Some(entry.display_name().to_string())
}

// ─── 路径解析 ────────────────────────────────────

/// 获取分类器模型和物种数据库路径
///
/// 查找顺序：
/// 1. 显式传入的路径（来自 Tauri resource_dir 解析）
/// 2. 相对路径 candidates（开发模式）
/// 3. 可执行文件目录相对路径（Windows 安装模式）
fn get_classifier_paths(
    explicit_model_path: Option<&Path>,
    explicit_db_path: Option<&Path>,
) -> Result<(PathBuf, PathBuf), AppError> {
    let model_path = resolve_path(
        explicit_model_path,
        &[
            "resources/models/bird_classifier.onnx",
            "src-tauri/resources/models/bird_classifier.onnx",
        ],
        "resources/models/bird_classifier.onnx",
        "bird_classifier.onnx",
    )?;

    let db_path = resolve_path(
        explicit_db_path,
        &[
            "resources/models/species_database.json",
            "src-tauri/resources/models/species_database.json",
        ],
        "resources/models/species_database.json",
        "species_database.json",
    )?;

    Ok((model_path, db_path))
}

/// 通用路径解析：显式路径 → 相对候选 → exe 相对路径
fn resolve_path(
    explicit: Option<&Path>,
    relative_candidates: &[&str],
    exe_relative: &str,
    file_name: &str,
) -> Result<PathBuf, AppError> {
    // 1. 显式路径
    if let Some(path) = explicit {
        if path.exists() {
            return Ok(path.to_path_buf());
        }
        log::warn!("显式指定的路径不存在: {}", path.display());
    }

    // 2. 相对路径候选
    for path_str in relative_candidates {
        let p = PathBuf::from(path_str);
        if p.exists() {
            return Ok(p);
        }
    }

    // 3. exe 相对路径
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            let rel_path = parent.join(exe_relative);
            if rel_path.exists() {
                return Ok(rel_path);
            }
        }
    }

    Err(AppError::ClassificationFailed(
        format!("文件 {} 未找到", file_name)
    ))
}

// ─── 公开 API ────────────────────────────────────

/// 基于 Tauri resource_dir 解析分类器模型和物种数据库路径
pub fn resolve_classifier_paths_from_resource_dir(
    resource_dir: &Path,
) -> (PathBuf, PathBuf) {
    let model = resource_dir
        .join("resources")
        .join("models")
        .join("bird_classifier.onnx");
    let db = resource_dir
        .join("resources")
        .join("models")
        .join("species_database.json");
    (model, db)
}

/// 对检测到的鸟类区域执行物种分类
///
/// 逐一对 `bboxes` 中的检测框裁剪并分类，填充 `species_name` 和 `species_confidence`。
/// Best-effort：任何步骤失败仅 log warn，不影响主流水线。
///
/// # 参数
/// - `image_path`: 待分类的图片路径
/// - `bboxes`: 检测框列表（会被原地修改）
/// - `model_path`: 分类器模型路径（显式路径或 None 自动查找）
/// - `db_path`: 物种数据库路径（显式路径或 None 自动查找）
pub fn classify_detections(
    image_path: &Path,
    bboxes: &mut Vec<DetectionBox>,
    model_path: Option<&Path>,
    db_path: Option<&Path>,
) -> Result<(), AppError> {
    if bboxes.is_empty() {
        return Ok(());
    }

    // 解析路径
    let (resolved_model, resolved_db) = get_classifier_paths(model_path, db_path)?;

    // 懒加载模型和数据库
    load_classifier_model(&resolved_model)?;
    load_species_database(&resolved_db)?;

    // 加载图片
    let img = match image::open(image_path) {
        Ok(img) => img,
        Err(e) => {
            log::warn!("分类器无法加载图片 {}: {}", image_path.display(), e);
            return Ok(()); // best-effort
        }
    };

    // 对每个 bbox 分类
    for bbox in bboxes.iter_mut() {
        let crop = crop_bbox_region(&img, bbox);

        match classify_crop(&crop) {
            Some((class_idx, confidence)) => {
                if confidence < SPECIES_CONFIDENCE_THRESHOLD {
                    log::debug!(
                        "分类置信度过低 ({:.1}%)，跳过物种标注",
                        confidence * 100.0
                    );
                    continue;
                }

                match lookup_species_name(class_idx) {
                    Some(name) => {
                        log::debug!(
                            "鸟种分类: {} (置信度 {:.1}%)",
                            name,
                            confidence * 100.0
                        );
                        bbox.species_name = Some(name);
                        bbox.species_confidence = Some(confidence);
                    }
                    None => {
                        log::warn!(
                            "类别索引 {} 在物种数据库中未找到",
                            class_idx
                        );
                    }
                }
            }
            None => {
                log::debug!("单个 bbox 分类推理失败，跳过");
            }
        }
    }

    Ok(())
}

// ─── 分组内多帧融合投票 ────────────────────────────────────

/// 分组内单张图片的分类结果（用于投票聚合）
struct FrameClassification {
    /// 该图各 bbox 的概率分布（每个 bbox 一个 Vec<f32>）
    prob_vectors: Vec<Vec<f32>>,
}

/// 对同组内多张图的分类结果执行概率平均融合
///
/// 核心思路：同一分组的图片拍摄的是同一只鸟，多帧概率取平均后 argmax，
/// 可以抵消单帧的角度/遮挡误判，比逐帧独立分类更准确。
///
/// 融合流程：
/// 1. 收集同组内所有图片的分类概率向量
/// 2. 对每个 bbox 位置，将所有帧的概率向量逐元素取平均
/// 3. 在平均概率上取 argmax 得到最终物种
/// 4. 用融合结果覆盖各 bbox 的 species_name 和 species_confidence
///
/// # 参数
/// - `image_paths_and_bboxes`: 同组内各图片的 (路径, bboxes) 列表
/// - `model_path`: 分类器模型路径
/// - `db_path`: 物种数据库路径
///
/// # 返回
/// 融合后的 (species_name, confidence) 列表，每个 bbox 位置一个。
/// 失败返回空 Vec（best-effort，不阻断主流程）。
pub fn classify_group_with_fusion(
    image_paths_and_bboxes: &mut [(&Path, &mut Vec<DetectionBox>)],
    model_path: Option<&Path>,
    db_path: Option<&Path>,
) -> Result<(), AppError> {
    if image_paths_and_bboxes.is_empty() {
        return Ok(());
    }

    // 解析路径并懒加载模型
    let (resolved_model, resolved_db) = get_classifier_paths(model_path, db_path)?;
    load_classifier_model(&resolved_model)?;
    load_species_database(&resolved_db)?;

    // 取第一张图的 bbox 数量作为参考（同组图片通常检测到相同数量的鸟）
    let num_bboxes = image_paths_and_bboxes
        .first()
        .map(|(_, bboxes)| bboxes.len())
        .unwrap_or(0);

    if num_bboxes == 0 {
        return Ok(());
    }

    // 1. 收集所有帧的分类概率向量
    let mut frame_results: Vec<FrameClassification> = Vec::new();

    for (image_path, bboxes) in &mut *image_paths_and_bboxes {
        let img = match image::open(&**image_path) {
            Ok(img) => img,
            Err(e) => {
                log::debug!("分组投票: 无法加载图片 {}: {}", image_path.display(), e);
                continue;
            }
        };

        let mut frame_cls = FrameClassification {
            prob_vectors: Vec::new(),
        };

        for bbox in bboxes.iter() {
            let crop = crop_bbox_region(&img, bbox);
            match classify_crop_with_probs(&crop) {
                Some((probs, _, _)) => frame_cls.prob_vectors.push(probs),
                None => {
                    log::debug!("分组投票: 单帧 bbox 分类失败，跳过");
                }
            }
        }

        if !frame_cls.prob_vectors.is_empty() {
            frame_results.push(frame_cls);
        }
    }

    // 至少需要 1 帧有效结果
    if frame_results.is_empty() {
        log::debug!("分组投票: 所有帧分类均失败，跳过融合");
        return Ok(());
    }

    // 2. 对每个 bbox 位置执行概率平均融合
    let num_classes = frame_results[0].prob_vectors[0].len();

    for bbox_idx in 0..num_bboxes {
        // 收集该 bbox 位置在各帧中的概率向量
        let mut fused_probs = vec![0.0f32; num_classes];
        let mut valid_frame_count = 0usize;

        for frame in &frame_results {
            if bbox_idx >= frame.prob_vectors.len() {
                continue;
            }
            let probs = &frame.prob_vectors[bbox_idx];
            if probs.len() != num_classes {
                continue;
            }
            for (i, p) in probs.iter().enumerate() {
                fused_probs[i] += p;
            }
            valid_frame_count += 1;
        }

        if valid_frame_count == 0 {
            continue;
        }

        // 取平均
        let scale = 1.0 / valid_frame_count as f32;
        for p in fused_probs.iter_mut() {
            *p *= scale;
        }

        // argmax
        let (best_idx, &best_prob) = fused_probs
            .iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .unwrap_or((0, &0.0));

        if best_prob < SPECIES_CONFIDENCE_THRESHOLD {
            log::debug!(
                "分组投票: bbox {} 融合置信度过低 ({:.1}%)",
                bbox_idx,
                best_prob * 100.0
            );
            continue;
        }

        // 查找物种名
        let species_name = match lookup_species_name(best_idx) {
            Some(name) => name,
            None => {
                log::warn!("分组投票: 类别索引 {} 在物种数据库中未找到", best_idx);
                continue;
            }
        };

        log::info!(
            "分组投票: bbox {} → {} (融合置信度 {:.1}%, {} 帧参与)",
            bbox_idx,
            species_name,
            best_prob * 100.0,
            valid_frame_count,
        );

        // 3. 将融合结果回写到所有图片的对应 bbox
        for (_image_path, bboxes) in &mut *image_paths_and_bboxes {
            if bbox_idx < bboxes.len() {
                bboxes[bbox_idx].species_name = Some(species_name.clone());
                bboxes[bbox_idx].species_confidence = Some(best_prob);
            }
        }
    }

    Ok(())
}

// ─── 单元测试 ────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── SpeciesEntry 测试 ──

    #[test]
    fn test_species_entry_deserialize() {
        let json = r#"{
            "class_id": 1,
            "scientific_name": "Accipiter badius",
            "common_name_en": "Shikra",
            "common_name_zh": "褐耳鹰",
            "order": "Accipitriformes",
            "family": "Accipitridae",
            "genus": "Accipiter"
        }"#;
        let entry: SpeciesEntry = serde_json::from_str(json).unwrap();
        assert_eq!(entry.class_id, 1);
        assert_eq!(entry.scientific_name, "Accipiter badius");
        assert_eq!(entry.common_name_en, "Shikra");
        assert_eq!(entry.common_name_zh, Some("褐耳鹰".to_string()));
    }

    #[test]
    fn test_species_entry_null_chinese_name() {
        let json = r#"{
            "class_id": 2,
            "scientific_name": "Some bird",
            "common_name_en": "English Name",
            "common_name_zh": null,
            "order": "Order",
            "family": "Family",
            "genus": "Genus"
        }"#;
        let entry: SpeciesEntry = serde_json::from_str(json).unwrap();
        assert!(entry.common_name_zh.is_none());
    }

    #[test]
    fn test_display_name_chinese_preferred() {
        let entry = SpeciesEntry {
            class_id: 1,
            scientific_name: "Accipiter badius".to_string(),
            common_name_en: "Shikra".to_string(),
            common_name_zh: Some("褐耳鹰".to_string()),
            order: "Accipitriformes".to_string(),
            family: "Accipitridae".to_string(),
            genus: "Accipiter".to_string(),
        };
        assert_eq!(entry.display_name(), "褐耳鹰");
    }

    #[test]
    fn test_display_name_fallback_english() {
        let entry = SpeciesEntry {
            class_id: 2,
            scientific_name: "Some bird".to_string(),
            common_name_en: "English Name".to_string(),
            common_name_zh: None,
            order: "Order".to_string(),
            family: "Family".to_string(),
            genus: "Genus".to_string(),
        };
        assert_eq!(entry.display_name(), "English Name");
    }

    #[test]
    fn test_display_name_empty_chinese_fallback() {
        let entry = SpeciesEntry {
            class_id: 3,
            scientific_name: "Test".to_string(),
            common_name_en: "English".to_string(),
            common_name_zh: Some("".to_string()),
            order: "O".to_string(),
            family: "F".to_string(),
            genus: "G".to_string(),
        };
        assert_eq!(entry.display_name(), "English");
    }

    // ── softmax 测试 ──

    #[test]
    fn test_softmax_sums_to_one() {
        let logits = vec![1.0, 2.0, 3.0, 4.0];
        let probs = softmax(&logits);
        let sum: f32 = probs.iter().sum();
        assert!((sum - 1.0).abs() < 1e-5, "softmax 概率和应为 1.0，实际 {}", sum);
    }

    #[test]
    fn test_softmax_all_equal() {
        let logits = vec![2.0, 2.0, 2.0];
        let probs = softmax(&logits);
        for p in &probs {
            assert!((p - 1.0 / 3.0).abs() < 1e-5);
        }
    }

    #[test]
    fn test_softmax_single_dominant() {
        let logits = vec![0.0, 0.0, 100.0];
        let probs = softmax(&logits);
        assert!(probs[2] > 0.99, "最大 logit 应占主导，实际 {}", probs[2]);
    }

    #[test]
    fn test_softmax_negative_logits() {
        let logits = vec![-5.0, -3.0, -1.0];
        let probs = softmax(&logits);
        let sum: f32 = probs.iter().sum();
        assert!((sum - 1.0).abs() < 1e-5);
        assert!(probs[2] > probs[1]);
        assert!(probs[1] > probs[0]);
    }

    // ── 图像预处理测试 ──

    #[test]
    fn test_image_to_classifier_input_shape() {
        let img = image::DynamicImage::ImageRgb8(
            image::ImageBuffer::from_pixel(300, 200, image::Rgb([128u8, 64u8, 32u8]))
        );
        let (shape, data) = image_to_classifier_input(&img);
        assert_eq!(shape, vec![1, 3, 224, 224]);
        assert_eq!(data.len(), 3 * 224 * 224);
    }

    #[test]
    fn test_image_to_classifier_input_imagenet_normalization() {
        // 像素 (128, 64, 32) → ImageNet 归一化后:
        // R = (128/255 - 0.485) / 0.229 ≈ 0.073
        // G = (64/255 - 0.456) / 0.224 ≈ -0.860
        // B = (32/255 - 0.406) / 0.225 ≈ -1.234
        // 使用 224×224 避免 resize 插值误差
        let img = image::DynamicImage::ImageRgb8(
            image::ImageBuffer::from_pixel(224, 224, image::Rgb([128u8, 64u8, 32u8]))
        );
        let (_, data) = image_to_classifier_input(&img);
        let hw = (224 * 224) as usize;
        let center = 112 * 224 + 112;
        let r = data[0 * hw + center];
        let g = data[1 * hw + center];
        let b = data[2 * hw + center];
        let expected_r = (128.0f32 / 255.0 - 0.485) / 0.229;
        let expected_g = (64.0f32 / 255.0 - 0.456) / 0.224;
        let expected_b = (32.0f32 / 255.0 - 0.406) / 0.225;
        assert!((r - expected_r).abs() < 1e-4, "R 通道应为 {}, 实际 {}", expected_r, r);
        assert!((g - expected_g).abs() < 1e-4, "G 通道应为 {}, 实际 {}", expected_g, g);
        assert!((b - expected_b).abs() < 1e-4, "B 通道应为 {}, 实际 {}", expected_b, b);
    }

    #[test]
    fn test_image_to_classifier_input_channel_order() {
        // 纯红像素 (255, 0, 0) → R=(1.0-0.485)/0.229, G=(0.0-0.456)/0.224, B=(0.0-0.406)/0.225
        let img = image::DynamicImage::ImageRgb8(
            image::ImageBuffer::from_pixel(100, 100, image::Rgb([255u8, 0u8, 0u8]))
        );
        let (_, data) = image_to_classifier_input(&img);
        let hw = (224 * 224) as usize;
        let center = 112 * 224 + 112;
        let expected_r = (255.0f32 / 255.0 - 0.485) / 0.229; // ≈ 2.251
        let expected_g = (0.0f32 / 255.0 - 0.456) / 0.224;   // ≈ -2.036
        let expected_b = (0.0f32 / 255.0 - 0.406) / 0.225;   // ≈ -1.804
        assert!((data[0 * hw + center] - expected_r).abs() < 1e-4, "R 通道应为 {}", expected_r);
        assert!((data[1 * hw + center] - expected_g).abs() < 1e-4, "G 通道应为 {}", expected_g);
        assert!((data[2 * hw + center] - expected_b).abs() < 1e-4, "B 通道应为 {}", expected_b);
    }

    // ── 裁剪测试 ──

    #[test]
    fn test_crop_bbox_region_normal() {
        let img = image::DynamicImage::ImageRgb8(
            image::ImageBuffer::from_pixel(800, 600, image::Rgb([100u8, 100u8, 100u8]))
        );
        let bbox = DetectionBox {
            x1: 0.25,
            y1: 0.25,
            x2: 0.75,
            y2: 0.75,
            confidence: 0.9,
            species_name: None,
            species_confidence: None,
        };
        let crop = crop_bbox_region(&img, &bbox);
        // bbox 像素: 400×300，向外扩展 25% → 各方向加 100/75
        // x1 = 200-100=100, y1 = 150-75=75, x2 = 600+100=700, y2 = 450+75=525
        assert_eq!(crop.width(), 600);
        assert_eq!(crop.height(), 450);
    }

    #[test]
    fn test_crop_bbox_region_full_image() {
        let img = image::DynamicImage::ImageRgb8(
            image::ImageBuffer::from_pixel(800, 600, image::Rgb([100u8, 100u8, 100u8]))
        );
        let bbox = DetectionBox {
            x1: 0.0,
            y1: 0.0,
            x2: 1.0,
            y2: 1.0,
            confidence: 0.9,
            species_name: None,
            species_confidence: None,
        };
        let crop = crop_bbox_region(&img, &bbox);
        // 全图 bbox，padding 超出边界时 clamp 到图片范围
        assert_eq!(crop.width(), 800);
        assert_eq!(crop.height(), 600);
    }

    #[test]
    fn test_crop_bbox_region_near_edge() {
        let img = image::DynamicImage::ImageRgb8(
            image::ImageBuffer::from_pixel(800, 600, image::Rgb([100u8, 100u8, 100u8]))
        );
        // bbox 紧贴左上角，padding 应被 clamp
        let bbox = DetectionBox {
            x1: 0.0,
            y1: 0.0,
            x2: 0.25,
            y2: 0.25,
            confidence: 0.9,
            species_name: None,
            species_confidence: None,
        };
        let crop = crop_bbox_region(&img, &bbox);
        // bbox: 200×150，padding: 50×37.5
        // x1 = max(0-50, 0) = 0, y1 = max(0-37.5, 0) = 0  (-37.5).floor()=-38, max(0,0)=0
        // x2 = min(200+50, 800) = 250, y2 = min(150+37.5, 600) = 188  (187.5).ceil()=188
        assert_eq!(crop.width(), 250);
        assert_eq!(crop.height(), 188);
    }

    #[test]
    fn test_crop_bbox_region_zero_size_fallback() {
        let img = image::DynamicImage::ImageRgb8(
            image::ImageBuffer::from_pixel(800, 600, image::Rgb([100u8, 100u8, 100u8]))
        );
        // x1 == x2，裁剪区域宽度为 0
        let bbox = DetectionBox {
            x1: 0.5,
            y1: 0.5,
            x2: 0.5,
            y2: 0.5,
            confidence: 0.9,
            species_name: None,
            species_confidence: None,
        };
        let crop = crop_bbox_region(&img, &bbox);
        // 退化为全图
        assert_eq!(crop.width(), 800);
        assert_eq!(crop.height(), 600);
    }

    // ── classify_detections 测试 ──

    #[test]
    fn test_classify_detections_empty_bboxes() {
        let result = classify_detections(
            Path::new("nonexistent.jpg"),
            &mut vec![],
            None,
            None,
        );
        // 空 bboxes 直接返回 Ok，不需要路径存在
        assert!(result.is_ok());
    }

    // ── 路径解析测试 ──

    #[test]
    fn test_resolve_classifier_paths_from_resource_dir() {
        let (model, db) = resolve_classifier_paths_from_resource_dir(Path::new("/app"));
        assert!(model.to_string_lossy().contains("bird_classifier.onnx"));
        assert!(db.to_string_lossy().contains("species_database.json"));
    }

    // ── QDQ 量化模型加载测试 ──

    #[test]
    fn test_load_qdq_quantized_model() {
        // 验证 QDQ 格式（DynamicQuantizeLinear + ConvInteger）的 INT8 量化模型
        // 能否被 Rust ort crate 正常加载和推理
        let model_path = Path::new("resources/models/bird_classifier.onnx");
        if !model_path.exists() {
            eprintln!("跳过: 模型文件不存在 ({:?})", model_path);
            return;
        }

        let session = ort::session::Session::builder()
            .expect("Session builder 创建失败")
            .with_intra_threads(2)
            .expect("线程配置失败")
            .commit_from_file(model_path);

        match session {
            Ok(mut sess) => {
                let input_info = &sess.inputs()[0];
                let output_info = &sess.outputs()[0];
                println!(
                    "QDQ 模型加载成功! 输入: {}, 输出: {}",
                    input_info.name(), output_info.name()
                );

                // 构造全零输入进行推理测试（与 classify_crop_with_probs 相同的 API）
                let shape = vec![1i64, 3, 224, 224];
                let data = vec![0.0f32; 3 * 224 * 224];
                let input_tensor =
                    ort::value::Tensor::from_array((shape, data)).expect("Tensor 创建失败");

                let inputs = ort::inputs!["images" => input_tensor];
                let outputs = sess.run(inputs).expect("推理失败");

                let output = outputs.get("output0").expect("未找到 output0");
                let (out_shape, out_data) = output
                    .try_extract_tensor::<f32>()
                    .expect("提取输出 tensor 失败");
                println!("推理成功! 输出形状: {:?}", out_shape);
                assert_eq!(out_data.len(), 11000);
            }
            Err(e) => {
                panic!("QDQ 模型加载失败: {}", e);
            }
        }
    }
}
