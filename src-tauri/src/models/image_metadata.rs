use serde::{Deserialize, Serialize};

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
}
