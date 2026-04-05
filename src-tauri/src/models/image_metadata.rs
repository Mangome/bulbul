use serde::{Deserialize, Serialize};

use crate::core::bird_detection::DetectionBox;
use crate::core::focus_score::FocusScoringMethod;

/// RAW 图像元数据结构体
/// 所有字段均为 Option<T>，以处理 EXIF 数据部分缺失的情况
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImageMetadata {
    // 时间信息
    pub capture_time: Option<String>,
    pub modify_time: Option<String>,

    // 相机信息
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub serial_number: Option<String>,

    // 镜头信息
    pub lens_model: Option<String>,
    pub lens_serial: Option<String>,
    pub focal_length: Option<f64>,

    // 曝光参数
    pub f_number: Option<f64>,
    pub exposure_time: Option<String>,
    pub iso_speed: Option<u32>,

    // 闪光灯
    pub flash_fired: Option<bool>,
    pub flash_mode: Option<String>,

    // 测光与曝光模式
    pub exposure_mode: Option<String>,
    pub metering_mode: Option<String>,
    pub exposure_compensation: Option<f64>,

    // 白平衡
    pub white_balance: Option<String>,
    pub color_space: Option<String>,

    // 图像尺寸
    pub image_width: Option<u32>,
    pub image_height: Option<u32>,
    pub orientation: Option<u16>,

    // GPS
    pub gps_latitude: Option<f64>,
    pub gps_longitude: Option<f64>,
    pub gps_altitude: Option<f64>,

    // 文件信息
    pub file_size: Option<u64>,
    pub compression: Option<String>,

    // 合焦程度评分（1-5 星）
    pub focus_score: Option<u32>,

    // 鸟类检测框（相对坐标 [0, 1]）
    #[serde(default)]
    pub detection_bboxes: Vec<DetectionBox>,

    // 合焦评分方法标记
    #[serde(default)]
    pub focus_score_method: Option<FocusScoringMethod>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_all_none() {
        let meta = ImageMetadata::default();
        assert!(meta.capture_time.is_none());
        assert!(meta.camera_make.is_none());
        assert!(meta.focal_length.is_none());
        assert!(meta.iso_speed.is_none());
        assert!(meta.gps_latitude.is_none());
        assert!(meta.file_size.is_none());
        assert!(meta.focus_score.is_none());
    }

    #[test]
    fn test_serialize_deserialize_roundtrip() {
        let mut meta = ImageMetadata::default();
        meta.camera_make = Some("Nikon".to_string());
        meta.iso_speed = Some(400);
        meta.focal_length = Some(50.0);

        let json = serde_json::to_string(&meta).unwrap();
        let deserialized: ImageMetadata = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.camera_make, Some("Nikon".to_string()));
        assert_eq!(deserialized.iso_speed, Some(400));
        assert_eq!(deserialized.focal_length, Some(50.0));
    }

    #[test]
    fn test_partial_json_deserialization() {
        let json = r#"{"cameraMake": "Canon", "isoSpeed": 800}"#;
        let meta: ImageMetadata = serde_json::from_str(json).unwrap();

        assert_eq!(meta.camera_make, Some("Canon".to_string()));
        assert_eq!(meta.iso_speed, Some(800));
        assert!(meta.capture_time.is_none());
        assert!(meta.focal_length.is_none());
    }

    #[test]
    fn test_null_fields_serialize() {
        let meta = ImageMetadata::default();
        let json = serde_json::to_string(&meta).unwrap();
        assert!(json.contains("null"));
    }

    #[test]
    fn test_old_json_without_new_fields_deserializes() {
        // 4.7: 旧 JSON 无 detectionBboxes/focusScoringMethod 时反序列化成功
        let json = r#"{"cameraMake": "Nikon", "isoSpeed": 400, "focusScore": 4}"#;
        let meta: ImageMetadata = serde_json::from_str(json).unwrap();

        assert_eq!(meta.camera_make, Some("Nikon".to_string()));
        assert_eq!(meta.focus_score, Some(4));
        assert!(meta.detection_bboxes.is_empty());
        assert!(meta.focus_score_method.is_none());
    }

    #[test]
    fn test_new_json_with_all_fields_deserializes() {
        // 4.8: 新 JSON 含完整字段时反序列化正确
        let json = r#"{
            "cameraMake": "Nikon",
            "focusScore": 5,
            "detectionBboxes": [
                {"x1": 0.2, "y1": 0.1, "x2": 0.8, "y2": 0.9, "confidence": 0.95}
            ],
            "focusScoreMethod": "BirdRegion"
        }"#;
        let meta: ImageMetadata = serde_json::from_str(json).unwrap();

        assert_eq!(meta.focus_score, Some(5));
        assert_eq!(meta.detection_bboxes.len(), 1);
        assert!((meta.detection_bboxes[0].confidence - 0.95).abs() < 0.001);
        assert_eq!(meta.focus_score_method, Some(FocusScoringMethod::BirdRegion));
    }

    #[test]
    fn test_detection_box_roundtrip() {
        // 4.9: DetectionBox 序列化/反序列化往返一致
        use crate::core::bird_detection::DetectionBox;

        let bbox = DetectionBox::new(0.2, 0.1, 0.8, 0.9, 0.95);
        let json = serde_json::to_string(&bbox).unwrap();
        let deserialized: DetectionBox = serde_json::from_str(&json).unwrap();

        assert_eq!(bbox, deserialized);
    }

    #[test]
    fn test_empty_detection_bboxes_serializes_as_array() {
        // 4.10: ImageMetadata 含空 detection_bboxes 时序列化为 []
        let meta = ImageMetadata::default();
        let json = serde_json::to_string(&meta).unwrap();

        assert!(json.contains("\"detectionBboxes\":[]"));
    }
}
