//! 鸟类检测模块
//!
//! 基于 YOLOv8s ONNX 模型的鸟类目标检测。
//!
//! 处理流程：
//! 1. 加载 ONNX 模型（首次缓存到内存）
//! 2. Letterbox 等比缩放输入图片到 640×640
//! 3. YOLOv8s 推理获得原始检测框
//! 4. NMS 非极大值抑制过滤重叠框
//! 5. 置信度阈值过滤（< 0.70 移除）
//! 6. 坐标反归一化回原始图片相对坐标 [0, 1]
//!
//! 性能：单张 medium JPEG ~50-150ms（CPU，现代硬件）

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use crate::models::AppError;

/// COCO 数据集中"鸟"的类别索引
const BIRD_CLASS_ID: usize = 14;

/// YOLOv8 输入尺寸
const INPUT_SIZE: u32 = 640;

/// 置信度阈值
const CONFIDENCE_THRESHOLD: f32 = 0.70;

/// NMS IoU 阈值
const NMS_IOU_THRESHOLD: f32 = 0.45;

/// 检测框坐标和置信度
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DetectionBox {
    /// 左边界，范围 [0, 1] 相对坐标
    pub x1: f32,
    /// 上边界，范围 [0, 1] 相对坐标
    pub y1: f32,
    /// 右边界，范围 [0, 1] 相对坐标
    pub x2: f32,
    /// 下边界，范围 [0, 1] 相对坐标
    pub y2: f32,
    /// 置信度，范围 [0, 1]
    pub confidence: f32,
}

impl DetectionBox {
    /// 创建新的检测框（自动 clamp 到 [0, 1]）
    pub fn new(x1: f32, y1: f32, x2: f32, y2: f32, confidence: f32) -> Self {
        Self {
            x1: x1.clamp(0.0, 1.0),
            y1: y1.clamp(0.0, 1.0),
            x2: x2.clamp(0.0, 1.0),
            y2: y2.clamp(0.0, 1.0),
            confidence: confidence.clamp(0.0, 1.0),
        }
    }

    /// 计算框的面积
    pub fn area(&self) -> f32 {
        (self.x2 - self.x1).max(0.0) * (self.y2 - self.y1).max(0.0)
    }

    /// 计算两个框的交集面积
    pub fn intersection(&self, other: &DetectionBox) -> f32 {
        let x1 = self.x1.max(other.x1);
        let y1 = self.y1.max(other.y1);
        let x2 = self.x2.min(other.x2);
        let y2 = self.y2.min(other.y2);

        if x2 <= x1 || y2 <= y1 {
            0.0
        } else {
            (x2 - x1) * (y2 - y1)
        }
    }

    /// 计算 IoU（Intersection over Union）
    pub fn iou(&self, other: &DetectionBox) -> f32 {
        let intersection = self.intersection(other);
        let union = self.area() + other.area() - intersection;

        if union <= 0.0 {
            0.0
        } else {
            intersection / union
        }
    }
}

/// 检测结果（多个检测框）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectionResult {
    pub bboxes: Vec<DetectionBox>,
}

// ─── ONNX 模型缓存（线程安全） ────────────────────────────────────

lazy_static::lazy_static! {
    static ref MODEL_SESSION: Mutex<Option<ort::session::Session>> = Mutex::new(None);
}

/// 加载 ONNX 模型到内存缓存
fn load_model(model_path: &Path) -> Result<(), AppError> {
    let mut session = MODEL_SESSION.lock().map_err(|_| {
        AppError::DetectionFailed("模型缓存锁定失败".to_string())
    })?;

    if session.is_some() {
        return Ok(()); // 已加载
    }

    let new_session = ort::session::Session::builder()
        .map_err(|e| AppError::DetectionFailed(format!("Session 构建失败: {}", e)))?
        .with_intra_threads(4)
        .map_err(|e| AppError::DetectionFailed(format!("线程配置失败: {}", e)))?
        .commit_from_file(model_path)
        .map_err(|e| AppError::DetectionFailed(format!("模型加载失败: {}", e)))?;

    *session = Some(new_session);
    Ok(())
}

// ─── Letterbox 等比缩放 ────────────────────────────────────

/// Letterbox 缩放信息，用于坐标反归一化
struct LetterboxInfo {
    canvas: image::ImageBuffer<image::Rgb<u8>, Vec<u8>>,
    pad_x: f32,
    pad_y: f32,
    scale: f32,
}

/// Letterbox 等比缩放：将图片缩放到 640×640，保持宽高比，灰色 padding
fn letterbox_resize(img: &image::DynamicImage) -> LetterboxInfo {
    let (orig_w, orig_h) = (img.width() as f32, img.height() as f32);
    let target = INPUT_SIZE as f32;

    // 计算缩放因子（保持宽高比，取较小的比例）
    let scale = (target / orig_w).min(target / orig_h);

    // 计算缩放后的尺寸
    let new_w = (orig_w * scale) as u32;
    let new_h = (orig_h * scale) as u32;

    // 缩放图片
    let resized = img.resize(new_w, new_h, image::imageops::FilterType::Lanczos3);

    // 创建 640×640 灰色画布
    let mut canvas = image::ImageBuffer::from_pixel(
        INPUT_SIZE,
        INPUT_SIZE,
        image::Rgb([114u8, 114u8, 114u8]), // YOLOv8 标准 padding 颜色
    );

    // 计算 padding（上下或左右）
    let pad_x = (INPUT_SIZE - new_w) / 2;
    let pad_y = (INPUT_SIZE - new_h) / 2;

    // 将缩放的图片粘贴到画布中央
    let rgb = resized.to_rgb8();
    for y in 0..new_h {
        for x in 0..new_w {
            let pixel = rgb.get_pixel(x, y);
            canvas.put_pixel(pad_x + x, pad_y + y, *pixel);
        }
    }

    LetterboxInfo {
        canvas,
        pad_x: pad_x as f32,
        pad_y: pad_y as f32,
        scale,
    }
}

// ─── YOLOv8s 推理 ────────────────────────────────────

/// 将 RGB 画布转换为 NCHW f32 张量，归一化到 [0, 1]
///
/// 返回 (shape, flat_data) 格式，shape = [1, 3, 640, 640]
fn canvas_to_input(canvas: &image::ImageBuffer<image::Rgb<u8>, Vec<u8>>) -> (Vec<i64>, Vec<f32>) {
    let (w, h) = (canvas.width() as usize, canvas.height() as usize);
    let mut data = vec![0.0f32; 3 * h * w];

    for y in 0..h {
        for x in 0..w {
            let pixel = canvas.get_pixel(x as u32, y as u32);
            data[0 * h * w + y * w + x] = pixel[0] as f32 / 255.0; // R
            data[1 * h * w + y * w + x] = pixel[1] as f32 / 255.0; // G
            data[2 * h * w + y * w + x] = pixel[2] as f32 / 255.0; // B
        }
    }

    (vec![1, 3, h as i64, w as i64], data)
}

/// 解析 YOLOv8s 输出张量，提取鸟类检测框
///
/// YOLOv8s 输出形状: [1, 84, 8400]
/// - 84 = 4 (cx, cy, w, h) + 80 (COCO 类别概率)
/// - 8400 = 三个尺度检测头的 anchor 数量
/// - 坐标是 640px 画布上的像素坐标
/// - 类别概率已经过 sigmoid，无需再做 softmax
fn parse_yolov8_output(
    shape: &[i64],
    data: &[f32],
    letterbox: &LetterboxInfo,
    orig_w: f32,
    orig_h: f32,
) -> Vec<DetectionBox> {
    // 期望 shape = [1, 84, 8400]
    if shape.len() != 3 {
        return vec![];
    }
    let num_features = shape[1] as usize; // 84
    let num_detections = shape[2] as usize; // 8400

    if num_features < 5 || data.len() < num_features * num_detections {
        return vec![];
    }

    let mut bboxes = Vec::new();

    for i in 0..num_detections {
        // 数据布局: data[feature_idx * num_detections + detection_idx]
        let cx = data[0 * num_detections + i];
        let cy = data[1 * num_detections + i];
        let w  = data[2 * num_detections + i];
        let h  = data[3 * num_detections + i];

        // bird 类 = COCO index 14, 偏移 4 → feature index 18
        let bird_conf = if BIRD_CLASS_ID + 4 < num_features {
            data[(BIRD_CLASS_ID + 4) * num_detections + i]
        } else {
            continue;
        };

        if bird_conf < CONFIDENCE_THRESHOLD {
            continue;
        }

        // xywh → xyxy（640px 画布坐标）
        let x1_px = cx - w / 2.0;
        let y1_px = cy - h / 2.0;
        let x2_px = cx + w / 2.0;
        let y2_px = cy + h / 2.0;

        // 画布坐标 → 原始图片相对坐标 [0, 1]
        let x1_rel = (x1_px - letterbox.pad_x) / (orig_w * letterbox.scale);
        let y1_rel = (y1_px - letterbox.pad_y) / (orig_h * letterbox.scale);
        let x2_rel = (x2_px - letterbox.pad_x) / (orig_w * letterbox.scale);
        let y2_rel = (y2_px - letterbox.pad_y) / (orig_h * letterbox.scale);

        bboxes.push(DetectionBox::new(x1_rel, y1_rel, x2_rel, y2_rel, bird_conf));
    }

    bboxes
}

/// 执行 YOLOv8s 推理
fn run_inference(
    canvas: &image::ImageBuffer<image::Rgb<u8>, Vec<u8>>,
    letterbox: &LetterboxInfo,
    orig_w: f32,
    orig_h: f32,
) -> Result<Vec<DetectionBox>, AppError> {
    let (shape, data) = canvas_to_input(canvas);

    // 创建 ort Tensor
    let input_tensor = ort::value::Tensor::from_array((shape.clone(), data)).map_err(|e| {
        AppError::DetectionFailed(format!("输入张量创建失败: {}", e))
    })?;

    let mut session_guard = MODEL_SESSION.lock().map_err(|_| {
        AppError::DetectionFailed("模型锁定失败".to_string())
    })?;

    let session = session_guard.as_mut().ok_or_else(|| {
        AppError::DetectionFailed("模型未加载".to_string())
    })?;

    let outputs = session.run(ort::inputs!["images" => input_tensor]).map_err(|e| {
        AppError::DetectionFailed(format!("模型推理失败: {}", e))
    })?;

    // YOLOv8s 输出名为 "output0"，形状 [1, 84, 8400]
    let output = outputs.get("output0").ok_or_else(|| {
        AppError::DetectionFailed("模型输出中未找到 output0".to_string())
    })?;

    let (out_shape, out_data) = output.try_extract_tensor::<f32>().map_err(|e| {
        AppError::DetectionFailed(format!("输出张量提取失败: {}", e))
    })?;

    Ok(parse_yolov8_output(&out_shape, out_data, letterbox, orig_w, orig_h))
}

// ─── NMS 非极大值抑制 ────────────────────────────────────

/// 计算 IoU 并执行 NMS
fn nms(detections: Vec<DetectionBox>, iou_threshold: f32) -> Vec<DetectionBox> {
    if detections.is_empty() {
        return vec![];
    }

    let mut sorted = detections;
    sorted.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal));

    let mut keep = Vec::new();

    for bbox in sorted.iter() {
        let mut skip = false;

        for kept_bbox in &keep {
            let iou = bbox.iou(kept_bbox);
            if iou > iou_threshold {
                skip = true;
                break;
            }
        }

        if !skip {
            keep.push(bbox.clone());
        }
    }

    keep
}

// ─── 置信度过滤 ────────────────────────────────────

/// 过滤低于阈值的框
fn filter_by_confidence(bboxes: Vec<DetectionBox>, threshold: f32) -> Vec<DetectionBox> {
    bboxes.into_iter().filter(|b| b.confidence >= threshold).collect()
}

// ─── 公开 API ────────────────────────────────────

/// 获取模型文件路径
///
/// 查找顺序：
/// 1. 显式传入的路径（来自 Tauri resource_dir 解析）
/// 2. 相对路径 candidates（开发模式）
/// 3. 可执行文件目录相对路径（Windows 安装模式）
fn get_model_path(explicit_path: Option<&Path>) -> Result<std::path::PathBuf, AppError> {
    // 1. 优先使用显式传入的路径（生产环境，Tauri resource_dir 解析）
    if let Some(path) = explicit_path {
        if path.exists() {
            return Ok(path.to_path_buf());
        }
        log::warn!("显式指定的模型路径不存在: {}", path.display());
    }

    // 2. 相对路径 candidates（开发模式）
    let candidates = [
        "resources/models/yolov8s.onnx",
        "src-tauri/resources/models/yolov8s.onnx",
    ];

    for path_str in &candidates {
        let p = std::path::PathBuf::from(path_str);
        if p.exists() {
            return Ok(p);
        }
    }

    // 3. 可执行文件目录相对路径（Windows 安装模式）
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            let rel_path = parent.join("resources/models/yolov8s.onnx");
            if rel_path.exists() {
                return Ok(rel_path);
            }
        }
    }

    Err(AppError::DetectionFailed(
        "模型文件 yolov8s.onnx 未找到".to_string()
    ))
}

/// 基于 Tauri resource_dir 解析模型文件路径
///
/// macOS .app bundle 中资源位于 Contents/Resources/ 下，
/// 而 current_exe() 返回 Contents/MacOS/bulbul，
/// 因此需要使用 Tauri 的 resource_dir 来正确定位。
pub fn resolve_model_path_from_resource_dir(resource_dir: &Path) -> PathBuf {
    resource_dir.join("resources").join("models").join("yolov8s.onnx")
}

/// 检测图片中的鸟
///
/// 返回检测到的鸟类框的列表（相对坐标 [0, 1]），按置信度降序排列
///
/// # 参数
/// - `image_path`: 待检测的图片路径
/// - `model_path`: 可选的模型文件路径（生产环境应传入 Tauri resource_dir 解析的路径）
pub fn detect_birds(image_path: &Path, model_path: Option<&Path>) -> Result<DetectionResult, AppError> {
    let resolved = get_model_path(model_path)?;
    load_model(&resolved)?;

    let img = image::open(image_path).map_err(|e| {
        AppError::ImageProcessError(format!("无法加载图片: {}", e))
    })?;

    let (orig_w, orig_h) = (img.width() as f32, img.height() as f32);

    let letterbox = letterbox_resize(&img);

    let mut bboxes = run_inference(&letterbox.canvas, &letterbox, orig_w, orig_h)?;

    // NMS 过滤重叠框
    bboxes = nms(bboxes, NMS_IOU_THRESHOLD);

    // 置信度过滤（parse 时已做初步过滤，这里确保一致）
    bboxes = filter_by_confidence(bboxes, CONFIDENCE_THRESHOLD);

    Ok(DetectionResult { bboxes })
}

// ─── 单元测试 ────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── Letterbox 缩放测试 ──

    #[test]
    fn test_letterbox_wide_image() {
        let img = image::ImageBuffer::from_pixel(800, 600, image::Rgb([100u8, 100u8, 100u8]));
        let dyn_img = image::DynamicImage::ImageRgb8(img);

        let info = letterbox_resize(&dyn_img);

        assert_eq!(info.canvas.width(), INPUT_SIZE);
        assert_eq!(info.canvas.height(), INPUT_SIZE);
        assert!(info.pad_x >= 0.0);
        assert!(info.pad_y > 0.0);
    }

    #[test]
    fn test_letterbox_tall_image() {
        let img = image::ImageBuffer::from_pixel(600, 800, image::Rgb([100u8, 100u8, 100u8]));
        let dyn_img = image::DynamicImage::ImageRgb8(img);

        let info = letterbox_resize(&dyn_img);

        assert_eq!(info.canvas.width(), INPUT_SIZE);
        assert_eq!(info.canvas.height(), INPUT_SIZE);
        assert!(info.pad_x > 0.0);
        assert!(info.pad_y >= 0.0);
    }

    #[test]
    fn test_letterbox_square_image() {
        let img = image::ImageBuffer::from_pixel(640, 640, image::Rgb([100u8, 100u8, 100u8]));
        let dyn_img = image::DynamicImage::ImageRgb8(img);

        let info = letterbox_resize(&dyn_img);

        assert_eq!(info.canvas.width(), INPUT_SIZE);
        assert_eq!(info.canvas.height(), INPUT_SIZE);
    }

    #[test]
    fn test_letterbox_extreme_ratio() {
        let img = image::ImageBuffer::from_pixel(2000, 200, image::Rgb([100u8, 100u8, 100u8]));
        let dyn_img = image::DynamicImage::ImageRgb8(img);

        let info = letterbox_resize(&dyn_img);

        assert_eq!(info.canvas.width(), INPUT_SIZE);
        assert_eq!(info.canvas.height(), INPUT_SIZE);
        assert!(info.pad_x >= 0.0 && info.pad_y > 0.0);
    }

    // ── NMS 测试 ──

    #[test]
    fn test_nms_overlapping_boxes() {
        let bboxes = vec![
            DetectionBox::new(0.0, 0.0, 0.5, 0.5, 0.95),
            DetectionBox::new(0.1, 0.1, 0.6, 0.6, 0.80),
        ];

        let result = nms(bboxes, 0.45);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].confidence, 0.95);
    }

    #[test]
    fn test_nms_independent_boxes() {
        let bboxes = vec![
            DetectionBox::new(0.0, 0.0, 0.3, 0.3, 0.9),
            DetectionBox::new(0.5, 0.5, 0.9, 0.9, 0.85),
        ];

        let result = nms(bboxes, 0.45);

        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_nms_empty_input() {
        let result = nms(vec![], 0.45);
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_nms_single_box() {
        let bboxes = vec![DetectionBox::new(0.2, 0.2, 0.8, 0.8, 0.9)];
        let result = nms(bboxes, 0.45);

        assert_eq!(result.len(), 1);
    }

    // ── 置信度过滤测试 ──

    #[test]
    fn test_confidence_filter_boundary() {
        let bboxes = vec![
            DetectionBox::new(0.0, 0.0, 0.3, 0.3, 0.75),
            DetectionBox::new(0.3, 0.3, 0.6, 0.6, 0.15),
            DetectionBox::new(0.6, 0.6, 0.9, 0.9, 0.25),
        ];

        let result = filter_by_confidence(bboxes, 0.25);

        assert_eq!(result.len(), 2);
        assert!(result.iter().all(|b| b.confidence >= 0.25));
    }

    #[test]
    fn test_confidence_filter_all_below_threshold() {
        let bboxes = vec![
            DetectionBox::new(0.0, 0.0, 0.3, 0.3, 0.1),
            DetectionBox::new(0.3, 0.3, 0.6, 0.6, 0.15),
        ];

        let result = filter_by_confidence(bboxes, 0.25);

        assert_eq!(result.len(), 0);
    }

    // ── IoU 计算测试 ──

    #[test]
    fn test_iou_complete_overlap() {
        let box1 = DetectionBox::new(0.0, 0.0, 1.0, 1.0, 0.9);
        let box2 = DetectionBox::new(0.0, 0.0, 1.0, 1.0, 0.8);

        assert_eq!(box1.iou(&box2), 1.0);
    }

    #[test]
    fn test_iou_no_overlap() {
        let box1 = DetectionBox::new(0.0, 0.0, 0.4, 0.4, 0.9);
        let box2 = DetectionBox::new(0.6, 0.6, 1.0, 1.0, 0.8);

        assert_eq!(box1.iou(&box2), 0.0);
    }

    #[test]
    fn test_iou_partial_overlap() {
        let box1 = DetectionBox::new(0.0, 0.0, 0.6, 0.6, 0.9);
        let box2 = DetectionBox::new(0.3, 0.3, 0.9, 0.9, 0.8);

        let iou = box1.iou(&box2);
        assert!(iou > 0.0 && iou < 1.0);
    }

    // ── 序列化测试 ──

    #[test]
    fn test_detection_box_serialization() {
        let bbox = DetectionBox::new(0.2, 0.1, 0.8, 0.9, 0.95);
        let json = serde_json::to_string(&bbox).unwrap();
        let deserialized: DetectionBox = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.x1, bbox.x1);
        assert_eq!(deserialized.confidence, bbox.confidence);
    }

    #[test]
    fn test_detection_result_serialization() {
        let result = DetectionResult {
            bboxes: vec![
                DetectionBox::new(0.2, 0.1, 0.8, 0.9, 0.95),
                DetectionBox::new(0.1, 0.1, 0.5, 0.5, 0.75),
            ],
        };

        let json = serde_json::to_string(&result).unwrap();
        let deserialized: DetectionResult = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.bboxes.len(), 2);
    }

    // ── 坐标反归一化测试 ──

    #[test]
    fn test_denormalize_clamp_out_of_bounds() {
        // DetectionBox::new clamps inputs to [0,1]
        let bbox = DetectionBox { x1: 0.0, y1: 0.0, x2: 1.0, y2: 1.0, confidence: 0.9 };
        assert!(bbox.x1 >= 0.0 && bbox.x1 <= 1.0);
        assert!(bbox.x2 >= 0.0 && bbox.x2 <= 1.0);
    }

    // ── 张量转换测试 ──

    #[test]
    fn test_canvas_to_input_shape() {
        let canvas = image::ImageBuffer::from_pixel(
            INPUT_SIZE,
            INPUT_SIZE,
            image::Rgb([128u8, 128u8, 128u8]),
        );

        let (shape, data) = canvas_to_input(&canvas);

        assert_eq!(shape, vec![1, 3, INPUT_SIZE as i64, INPUT_SIZE as i64]);
        assert_eq!(data.len(), 3 * INPUT_SIZE as usize * INPUT_SIZE as usize);
    }

    #[test]
    fn test_canvas_to_input_normalization() {
        // 白色像素 (255, 255, 255) 应归一化为 1.0
        let canvas = image::ImageBuffer::from_pixel(
            INPUT_SIZE,
            INPUT_SIZE,
            image::Rgb([255u8, 255u8, 255u8]),
        );

        let (_, data) = canvas_to_input(&canvas);
        let hw = (INPUT_SIZE * INPUT_SIZE) as usize;

        assert!((data[0] - 1.0).abs() < 1e-5);          // R channel first pixel
        assert!((data[hw] - 1.0).abs() < 1e-5);          // G channel first pixel
        assert!((data[2 * hw] - 1.0).abs() < 1e-5);      // B channel first pixel
    }

    #[test]
    fn test_canvas_to_input_channel_order() {
        // 红色像素 (255, 0, 0) → R=1.0, G=0.0, B=0.0
        let canvas = image::ImageBuffer::from_pixel(
            INPUT_SIZE,
            INPUT_SIZE,
            image::Rgb([255u8, 0u8, 0u8]),
        );

        let (_, data) = canvas_to_input(&canvas);
        let hw = (INPUT_SIZE * INPUT_SIZE) as usize;

        assert!((data[0] - 1.0).abs() < 1e-5);   // R
        assert!(data[hw].abs() < 1e-5);            // G
        assert!(data[2 * hw].abs() < 1e-5);        // B
    }

    // ── YOLOv8 输出解析测试 ──

    #[test]
    fn test_parse_yolov8_output_empty() {
        let letterbox = LetterboxInfo {
            canvas: image::ImageBuffer::from_pixel(INPUT_SIZE, INPUT_SIZE, image::Rgb([114u8, 114u8, 114u8])),
            pad_x: 0.0,
            pad_y: 0.0,
            scale: 1.0,
        };

        // 模拟全零输出 [1, 84, 8400]
        let shape = vec![1i64, 84, 8400];
        let data = vec![0.0f32; 84 * 8400];
        let bboxes = parse_yolov8_output(&shape, &data, &letterbox, 640.0, 640.0);

        // 全零 → 所有类别概率为 0 → 不应该有任何检测
        assert!(bboxes.is_empty());
    }

    #[test]
    fn test_parse_yolov8_output_with_bird() {
        let letterbox = LetterboxInfo {
            canvas: image::ImageBuffer::from_pixel(INPUT_SIZE, INPUT_SIZE, image::Rgb([114u8, 114u8, 114u8])),
            pad_x: 0.0,
            pad_y: 0.0,
            scale: 1.0,
        };

        // 模拟输出 [1, 84, 8400]
        let shape = vec![1i64, 84, 8400];
        let mut data = vec![0.0f32; 84 * 8400];
        let nd = 8400usize;

        // 在第 0 个检测位置放入一只鸟: cx=320, cy=320, w=200, h=200
        data[0 * nd + 0] = 320.0;  // cx
        data[1 * nd + 0] = 320.0;  // cy
        data[2 * nd + 0] = 200.0;  // w
        data[3 * nd + 0] = 200.0;  // h
        // BIRD_CLASS_ID=14, 偏移 4 → feature index 18
        data[(BIRD_CLASS_ID + 4) * nd + 0] = 0.9;

        let bboxes = parse_yolov8_output(&shape, &data, &letterbox, 640.0, 640.0);

        assert_eq!(bboxes.len(), 1);
        assert!((bboxes[0].confidence - 0.9).abs() < 0.01);
        // cx=320, w=200 → x1=(320-100)/640=0.34, x2=(320+100)/640=0.66
        assert!((bboxes[0].x1 - 0.34).abs() < 0.02);
        assert!((bboxes[0].x2 - 0.66).abs() < 0.02);
    }

    #[test]
    fn test_parse_yolov8_output_non_bird_ignored() {
        let letterbox = LetterboxInfo {
            canvas: image::ImageBuffer::from_pixel(INPUT_SIZE, INPUT_SIZE, image::Rgb([114u8, 114u8, 114u8])),
            pad_x: 0.0,
            pad_y: 0.0,
            scale: 1.0,
        };

        let shape = vec![1i64, 84, 8400];
        let mut data = vec![0.0f32; 84 * 8400];
        let nd = 8400usize;

        // 放入一个 person (class 0) 高置信度检测
        data[0 * nd + 0] = 320.0;
        data[1 * nd + 0] = 320.0;
        data[2 * nd + 0] = 200.0;
        data[3 * nd + 0] = 200.0;
        data[4 * nd + 0] = 0.95; // person class (index 0 + 4 = 4)

        let bboxes = parse_yolov8_output(&shape, &data, &letterbox, 640.0, 640.0);

        // person 不是 bird → 应该为空
        assert!(bboxes.is_empty());
    }

    // ── 模型文件加载测试 ──

    #[test]
    fn test_model_file_path_resolution() {
        // 验证 get_model_path() 能正确找到模型文件
        let model_path = super::get_model_path(None);
        match model_path {
            Ok(path) => {
                println!("✓ 模型文件路径: {:?}", path);
                assert!(path.exists(), "模型文件应该存在");
                assert!(path.to_string_lossy().contains("yolov8s.onnx"));
            }
            Err(e) => {
                panic!("模型文件加载失败: {:?}", e);
            }
        }
    }

    #[test]
    fn test_model_file_size() {
        // 验证模型文件大小约为 22MB（容许 ±2MB 偏差）
        match super::get_model_path(None) {
            Ok(path) => {
                let metadata = std::fs::metadata(&path).expect("无法读取模型文件元数据");
                let file_size = metadata.len();
                let expected_min = 20 * 1024 * 1024;  // 20MB
                let expected_max = 50 * 1024 * 1024;  // 50MB
                
                println!("✓ 模型文件大小: {:.1}MB", file_size as f64 / (1024.0 * 1024.0));
                assert!(file_size >= expected_min && file_size <= expected_max,
                    "模型文件大小应在 20-50MB 范围内，实际: {:.1}MB",
                    file_size as f64 / (1024.0 * 1024.0)
                );
            }
            Err(e) => {
                panic!("模型文件查询失败: {:?}", e);
            }
        }
    }

    // ── 集成测试：真实 JPEG 图片与 YOLOv8s 模型 ──

    #[test]
    #[ignore]  // 仅在有完整环境时运行
    fn test_real_model_detection_with_nef() {
        // 运行方式：cargo test test_real_model_detection_with_nef -- --ignored --nocapture

        let nef_path = std::path::Path::new("C:/Users/Mango/Desktop/11/DSC_9097.NEF");
        if !nef_path.exists() {
            println!("跳过：NEF 文件不存在: {:?}", nef_path);
            return;
        }

        use crate::core::nef_parser::extract_largest_jpeg;

        let nef_data = std::fs::read(nef_path).expect("无法读取 NEF 文件");
        println!("✓ 已读取 NEF 文件: {} 字节", nef_data.len());

        let jpeg_data = extract_largest_jpeg(&nef_data).expect("无法提取 JPEG");
        println!("✓ 已从 NEF 提取 JPEG: {} 字节", jpeg_data.len());

        let tmp_dir = tempfile::tempdir().unwrap();
        let tmp_jpeg = tmp_dir.path().join("test.jpg");
        std::fs::write(&tmp_jpeg, &jpeg_data).unwrap();

        let start = std::time::Instant::now();
        let result = detect_birds(&tmp_jpeg, None).expect("检测失败");
        let elapsed = start.elapsed();

        println!("✓ 检测完成: {} 只鸟, 耗时 {:.1}ms", result.bboxes.len(), elapsed.as_secs_f64() * 1000.0);
        for (i, bbox) in result.bboxes.iter().enumerate() {
            println!(
                "  框 {}: 置信度 {:.2}%, 坐标 ({:.3}, {:.3}) - ({:.3}, {:.3})",
                i + 1,
                bbox.confidence * 100.0,
                bbox.x1, bbox.y1, bbox.x2, bbox.y2
            );
        }
    }
}
