use serde::Serialize;

/// 应用错误类型
#[derive(Debug, thiserror::Error)]
#[allow(dead_code)]
pub enum AppError {
    #[error("文件未找到: {0}")]
    FileNotFound(String),

    #[error("NEF 解析错误: {0}")]
    NefParseError(String),

    #[error("EXIF 读取错误: {0}")]
    ExifError(String),

    #[error("未找到嵌入的 JPEG 预览")]
    NoEmbeddedJpeg,

    #[error("图像处理错误: {0}")]
    ImageProcessError(String),

    #[error("操作已取消")]
    Cancelled,

    #[error("IO 错误: {0}")]
    IoError(#[from] std::io::Error),

    #[error("缓存错误: {0}")]
    CacheError(String),

    #[error("导出错误: {0}")]
    ExportError(String),

    #[error("配置错误: {0}")]
    ConfigError(String),

    #[error("哈希计算错误: {0}")]
    HashError(String),

    #[error("目标检测失败: {0}")]
    DetectionFailed(String),
}

impl AppError {
    /// 返回面向用户的中文友好提示
    #[allow(dead_code)]
    pub fn user_message(&self) -> String {
        match self {
            AppError::FileNotFound(path) => format!("找不到文件「{}」，请检查路径是否正确", path),
            AppError::NefParseError(_) => "NEF 文件解析失败，该文件可能已损坏或格式不受支持".to_string(),
            AppError::ExifError(_) => "无法读取照片的拍摄信息，该文件的 EXIF 数据可能缺失".to_string(),
            AppError::NoEmbeddedJpeg => "该 NEF 文件中未找到预览图像".to_string(),
            AppError::ImageProcessError(_) => "图像处理过程中出现错误，请重试".to_string(),
            AppError::Cancelled => "操作已取消".to_string(),
            AppError::IoError(e) => format!("文件操作失败：{}", e),
            AppError::CacheError(_) => "缓存操作失败，请检查磁盘空间".to_string(),
            AppError::ExportError(_) => "导出失败，请检查目标目录权限".to_string(),
            AppError::ConfigError(_) => "配置加载失败，请检查应用设置".to_string(),
            AppError::HashError(_) => "图像指纹计算失败，请重试".to_string(),
            AppError::DetectionFailed(_) => "目标检测失败，将跳过该图片的区域评分".to_string(),
        }
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_not_found_serialization() {
        let err = AppError::FileNotFound("test.nef".to_string());
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(json, "\"文件未找到: test.nef\"");
    }

    #[test]
    fn test_nef_parse_error_serialization() {
        let err = AppError::NefParseError("invalid header".to_string());
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(json, "\"NEF 解析错误: invalid header\"");
    }

    #[test]
    fn test_no_embedded_jpeg_serialization() {
        let err = AppError::NoEmbeddedJpeg;
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(json, "\"未找到嵌入的 JPEG 预览\"");
    }

    #[test]
    fn test_cancelled_serialization() {
        let err = AppError::Cancelled;
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(json, "\"操作已取消\"");
    }

    #[test]
    fn test_io_error_conversion() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let app_err: AppError = io_err.into();
        match app_err {
            AppError::IoError(_) => {}
            _ => panic!("Expected IoError variant"),
        }
    }

    // ── 新增变体测试 ──

    #[test]
    fn test_cache_error_serialization() {
        let err = AppError::CacheError("disk full".to_string());
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(json, "\"缓存错误: disk full\"");
    }

    #[test]
    fn test_export_error_serialization() {
        let err = AppError::ExportError("permission denied".to_string());
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(json, "\"导出错误: permission denied\"");
    }

    #[test]
    fn test_config_error_serialization() {
        let err = AppError::ConfigError("missing key".to_string());
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(json, "\"配置错误: missing key\"");
    }

    #[test]
    fn test_hash_error_serialization() {
        let err = AppError::HashError("invalid input".to_string());
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(json, "\"哈希计算错误: invalid input\"");
    }

    // ── user_message 测试 ──

    #[test]
    fn test_file_not_found_user_message() {
        let err = AppError::FileNotFound("test.nef".to_string());
        assert!(err.user_message().contains("找不到文件"));
        assert!(err.user_message().contains("test.nef"));
    }

    #[test]
    fn test_cache_error_user_message() {
        let err = AppError::CacheError("disk full".to_string());
        assert!(err.user_message().contains("缓存操作失败"));
    }

    #[test]
    fn test_export_error_user_message() {
        let err = AppError::ExportError("permission denied".to_string());
        assert!(err.user_message().contains("导出失败"));
    }

    #[test]
    fn test_config_error_user_message() {
        let err = AppError::ConfigError("missing key".to_string());
        assert!(err.user_message().contains("配置加载失败"));
    }

    #[test]
    fn test_hash_error_user_message() {
        let err = AppError::HashError("invalid input".to_string());
        assert!(err.user_message().contains("图像指纹计算失败"));
    }

    #[test]
    fn test_detection_failed_serialization() {
        let err = AppError::DetectionFailed("model load error".to_string());
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(json, "\"目标检测失败: model load error\"");
    }

    #[test]
    fn test_detection_failed_user_message() {
        let err = AppError::DetectionFailed("inference timeout".to_string());
        assert!(err.user_message().contains("目标检测失败"));
    }

    #[test]
    fn test_cancelled_user_message() {
        let err = AppError::Cancelled;
        assert_eq!(err.user_message(), "操作已取消");
    }

    #[test]
    fn test_nef_parse_error_user_message() {
        let err = AppError::NefParseError("bad format".to_string());
        assert!(err.user_message().contains("NEF 文件解析失败"));
    }

    #[test]
    fn test_no_embedded_jpeg_user_message() {
        let err = AppError::NoEmbeddedJpeg;
        assert!(err.user_message().contains("未找到预览图像"));
    }

    #[test]
    fn test_image_process_error_user_message() {
        let err = AppError::ImageProcessError("decode failed".to_string());
        assert!(err.user_message().contains("图像处理过程中出现错误"));
    }
}
