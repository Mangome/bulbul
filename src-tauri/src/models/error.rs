use serde::Serialize;

/// 应用错误类型
#[derive(Debug, thiserror::Error)]
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
}
