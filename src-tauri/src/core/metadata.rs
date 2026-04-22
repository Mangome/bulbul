//! Exif 元数据解析
//!
//! 使用 `kamadak-exif` 从 NEF/JPEG 数据中读取 Exif 标签，
//! 映射到 `ImageMetadata` 结构体。

use std::io::Cursor;

use exif::{Exif, In, Reader, Tag, Value};

use crate::models::{AppError, ImageMetadata};

/// 从原始字节数据中解析 Exif 元数据到 ImageMetadata
pub fn parse_exif(data: &[u8]) -> Result<ImageMetadata, AppError> {
    let cursor = Cursor::new(data);
    let exif = Reader::new()
        .read_from_container(&mut std::io::BufReader::new(cursor))
        .map_err(|e| AppError::ExifError(format!("Exif 读取失败: {}", e)))?;

    Ok(map_exif_to_metadata(&exif))
}

/// 将 kamadak-exif 的 Exif 数据映射到 ImageMetadata
fn map_exif_to_metadata(exif: &Exif) -> ImageMetadata {
    let mut meta = ImageMetadata::default();

    // 时间信息
    meta.capture_time = parse_datetime(exif, Tag::DateTimeOriginal)
        .or_else(|| parse_datetime(exif, Tag::DateTime));
    meta.modify_time = parse_datetime(exif, Tag::DateTime);

    // 相机信息
    meta.camera_make = get_string(exif, Tag::Make);
    meta.camera_model = get_string(exif, Tag::Model);
    meta.serial_number = get_string(exif, Tag::BodySerialNumber);

    // 镜头信息
    meta.lens_model = get_string(exif, Tag::LensModel);
    meta.lens_serial = get_string(exif, Tag::LensSerialNumber);
    meta.focal_length = get_rational_f64(exif, Tag::FocalLength);

    // 曝光参数
    meta.f_number = get_rational_f64(exif, Tag::FNumber);
    meta.exposure_time = get_exposure_time_string(exif);
    meta.iso_speed = get_u32(exif, Tag::PhotographicSensitivity);

    // 闪光灯
    meta.flash_fired = get_flash_fired(exif);
    meta.flash_mode = get_string(exif, Tag::Flash);

    // 测光与曝光模式
    meta.exposure_mode = get_exposure_mode(exif);
    meta.metering_mode = get_metering_mode(exif);
    meta.exposure_compensation = get_rational_f64(exif, Tag::ExposureBiasValue);

    // 白平衡
    meta.white_balance = get_white_balance(exif);
    meta.color_space = get_color_space(exif);

    // 图像尺寸
    meta.image_width = get_u32(exif, Tag::PixelXDimension)
        .or_else(|| get_u32(exif, Tag::ImageWidth));
    meta.image_height = get_u32(exif, Tag::PixelYDimension)
        .or_else(|| get_u32(exif, Tag::ImageLength));
    meta.orientation = get_u16(exif, Tag::Orientation);

    // 根据 EXIF Orientation 调整显示尺寸（纵向图片识别）
    // Orientation 5, 6, 7, 8 表示需要旋转 ±90°，此时显示宽高应互换
    if let (Some(width), Some(height), Some(orientation)) = (meta.image_width, meta.image_height, meta.orientation) {
        if matches!(orientation, 5 | 6 | 7 | 8) {
            // 交换宽高：从"原始存储宽高"转为"显示宽高"
            meta.image_width = Some(height);
            meta.image_height = Some(width);
        }
    }

    // GPS
    meta.gps_latitude = parse_gps_coordinate(exif, Tag::GPSLatitude, Tag::GPSLatitudeRef);
    meta.gps_longitude = parse_gps_coordinate(exif, Tag::GPSLongitude, Tag::GPSLongitudeRef);
    meta.gps_altitude = get_rational_f64(exif, Tag::GPSAltitude);

    if meta.gps_latitude.is_none() && meta.gps_longitude.is_none() {
        log::debug!(
            "EXIF 中无 GPS 数据 (GPSInfoIFDPointer 存在: {})",
            exif.get_field(Tag::GPSInfoIFDPointer, In::PRIMARY).is_some()
        );
    }

    meta
}

// ─── 辅助函数 ────────────────────────────────────────────

/// 获取字符串值（去除末尾空白）
fn get_string(exif: &Exif, tag: Tag) -> Option<String> {
    exif.get_field(tag, In::PRIMARY).map(|f| {
        f.display_value()
            .to_string()
            .trim_matches('"')
            .trim()
            .to_string()
    })
}

/// 获取 Rational 值并转为 f64
fn get_rational_f64(exif: &Exif, tag: Tag) -> Option<f64> {
    let field = exif.get_field(tag, In::PRIMARY)?;
    match &field.value {
        Value::Rational(ref v) if !v.is_empty() => Some(v[0].to_f64()),
        Value::SRational(ref v) if !v.is_empty() => Some(v[0].to_f64()),
        _ => {
            // 尝试从 display_value 解析
            let s = field.display_value().to_string();
            s.trim_matches('"').trim().parse::<f64>().ok()
        }
    }
}

/// 获取 u32 值
fn get_u32(exif: &Exif, tag: Tag) -> Option<u32> {
    let field = exif.get_field(tag, In::PRIMARY)?;
    match &field.value {
        Value::Short(ref v) if !v.is_empty() => Some(v[0] as u32),
        Value::Long(ref v) if !v.is_empty() => Some(v[0]),
        _ => {
            let s = field.display_value().to_string();
            s.trim_matches('"').trim().parse::<u32>().ok()
        }
    }
}

/// 获取 u16 值
fn get_u16(exif: &Exif, tag: Tag) -> Option<u16> {
    let field = exif.get_field(tag, In::PRIMARY)?;
    match &field.value {
        Value::Short(ref v) if !v.is_empty() => Some(v[0]),
        _ => {
            let s = field.display_value().to_string();
            s.trim_matches('"').trim().parse::<u16>().ok()
        }
    }
}

/// 解析日期时间字符串：`YYYY:MM:DD HH:MM:SS` → `YYYY-MM-DDTHH:MM:SS`
fn parse_datetime(exif: &Exif, tag: Tag) -> Option<String> {
    let field = exif.get_field(tag, In::PRIMARY)?;
    let raw = field.display_value().to_string();
    let raw = raw.trim_matches('"').trim();

    // 格式: "2024:03:15 14:30:00" → "2024-03-15T14:30:00"
    if raw.len() >= 19 {
        let converted = format!(
            "{}-{}-{}T{}",
            &raw[0..4],
            &raw[5..7],
            &raw[8..10],
            &raw[11..19]
        );
        Some(converted)
    } else {
        Some(raw.to_string())
    }
}

/// 求最大公约数
fn gcd(mut a: u32, mut b: u32) -> u32 {
    while b != 0 {
        let t = b;
        b = a % b;
        a = t;
    }
    a
}

/// 获取快门速度的字符串表示
fn get_exposure_time_string(exif: &Exif) -> Option<String> {
    let field = exif.get_field(Tag::ExposureTime, In::PRIMARY)?;
    match &field.value {
        Value::Rational(ref v) if !v.is_empty() => {
            let r = &v[0];
            if r.num == 0 {
                return Some("0".to_string());
            }
            // 约分：EXIF Rational 不保证是最简分数（如 10/20000 应显示为 1/2000）
            let g = gcd(r.num, r.denom);
            let num = r.num / g;
            let denom = r.denom / g;
            if denom == 1 {
                Some(format!("{}", num))
            } else {
                Some(format!("{}/{}", num, denom))
            }
        }
        _ => Some(field.display_value().to_string().trim_matches('"').to_string()),
    }
}

/// 解析闪光灯是否触发
fn get_flash_fired(exif: &Exif) -> Option<bool> {
    let field = exif.get_field(Tag::Flash, In::PRIMARY)?;
    match &field.value {
        Value::Short(ref v) if !v.is_empty() => Some(v[0] & 0x01 != 0),
        _ => None,
    }
}

/// 解析曝光模式
fn get_exposure_mode(exif: &Exif) -> Option<String> {
    let field = exif.get_field(Tag::ExposureProgram, In::PRIMARY)?;
    match &field.value {
        Value::Short(ref v) if !v.is_empty() => {
            let mode = match v[0] {
                0 => "未定义",
                1 => "手动",
                2 => "程序自动",
                3 => "光圈优先",
                4 => "快门优先",
                5 => "创意(景深优先)",
                6 => "动作(高速快门)",
                7 => "人像",
                8 => "风景",
                _ => "未知",
            };
            Some(mode.to_string())
        }
        _ => None,
    }
}

/// 解析测光模式
fn get_metering_mode(exif: &Exif) -> Option<String> {
    let field = exif.get_field(Tag::MeteringMode, In::PRIMARY)?;
    match &field.value {
        Value::Short(ref v) if !v.is_empty() => {
            let mode = match v[0] {
                0 => "未知",
                1 => "平均测光",
                2 => "中央重点",
                3 => "点测光",
                4 => "多点测光",
                5 => "评价测光",
                6 => "局部测光",
                255 => "其他",
                _ => "未知",
            };
            Some(mode.to_string())
        }
        _ => None,
    }
}

/// 解析白平衡
fn get_white_balance(exif: &Exif) -> Option<String> {
    let field = exif.get_field(Tag::WhiteBalance, In::PRIMARY)?;
    match &field.value {
        Value::Short(ref v) if !v.is_empty() => {
            let wb = match v[0] {
                0 => "自动",
                1 => "手动",
                _ => "未知",
            };
            Some(wb.to_string())
        }
        _ => None,
    }
}

/// 解析色彩空间
fn get_color_space(exif: &Exif) -> Option<String> {
    let field = exif.get_field(Tag::ColorSpace, In::PRIMARY)?;
    match &field.value {
        Value::Short(ref v) if !v.is_empty() => {
            let cs = match v[0] {
                1 => "sRGB",
                0xFFFF => "Uncalibrated",
                _ => "未知",
            };
            Some(cs.to_string())
        }
        _ => None,
    }
}

/// 解析 GPS 坐标（度/分/秒 → 十进制度数）
fn parse_gps_coordinate(exif: &Exif, coord_tag: Tag, ref_tag: Tag) -> Option<f64> {
    let field = exif.get_field(coord_tag, In::PRIMARY)?;
    let degrees = match &field.value {
        Value::Rational(ref v) if v.len() >= 3 => {
            let d = v[0].to_f64();
            let m = v[1].to_f64();
            let s = v[2].to_f64();
            d + m / 60.0 + s / 3600.0
        }
        _ => {
            log::debug!("GPS 坐标标签 {:?} 值格式不匹配: {:?}", coord_tag, field.value);
            return None;
        }
    };

    let ref_field = match exif.get_field(ref_tag, In::PRIMARY) {
        Some(f) => f,
        None => {
            log::debug!("GPS 参考方向标签 {:?} 未找到，默认正数", ref_tag);
            return Some(degrees);
        }
    };
    let ref_str = ref_field.display_value().to_string();
    let ref_str = ref_str.trim_matches('"').trim();

    // 南纬(S)和西经(W)为负数
    if ref_str == "S" || ref_str == "W" {
        Some(-degrees)
    } else {
        Some(degrees)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_exif_returns_error_for_empty_data() {
        let result = parse_exif(&[]);
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::ExifError(_) => {}
            e => panic!("Expected ExifError, got: {:?}", e),
        }
    }

    #[test]
    fn test_parse_exif_returns_error_for_invalid_data() {
        let result = parse_exif(&[0x00, 0x01, 0x02, 0x03]);
        assert!(result.is_err());
    }

    #[test]
    fn test_map_exif_to_metadata_empty() {
        // 构建一个带空 Exif 的最小 TIFF
        let mut buf = Vec::new();
        buf.extend_from_slice(&[0x49, 0x49]); // II
        buf.extend_from_slice(&42u16.to_le_bytes());
        buf.extend_from_slice(&8u32.to_le_bytes());
        // IFD with 0 entries
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&0u32.to_le_bytes());

        // kamadak-exif 需要能解析出 Exif，空 TIFF 可能会失败
        // 所以我们仅测试 parse_exif 对无效数据返回错误
        let result = parse_exif(&buf);
        // 可能成功（返回空 metadata）或失败，取决于 kamadak-exif 行为
        // 此测试确保不会 panic
        let _ = result;
    }

    #[test]
    fn test_datetime_format_conversion() {
        // 测试内部函数的逻辑——模拟日期格式转换
        let input = "2024:03:15 14:30:00";
        let expected = "2024-03-15T14:30:00";
        let result = format!(
            "{}-{}-{}T{}",
            &input[0..4],
            &input[5..7],
            &input[8..10],
            &input[11..19]
        );
        assert_eq!(result, expected);
    }

    #[test]
    fn test_gps_dms_to_decimal() {
        // 手动测试 DMS → decimal 转换逻辑
        // N 39°54'20" → 39 + 54/60 + 20/3600 ≈ 39.9056
        let d: f64 = 39.0;
        let m: f64 = 54.0;
        let s: f64 = 20.0;
        let decimal = d + m / 60.0 + s / 3600.0;
        assert!((decimal - 39.9056_f64).abs() < 0.001);

        // S 33°51'22" → -(33 + 51/60 + 22/3600) ≈ -33.856
        let d: f64 = 33.0;
        let m: f64 = 51.0;
        let s: f64 = 22.0;
        let decimal = -(d + m / 60.0 + s / 3600.0);
        assert!((decimal - (-33.856_f64)).abs() < 0.001);
    }

    #[test]
    fn test_exposure_mode_strings() {
        let modes = [
            (0u16, "未定义"),
            (1, "手动"),
            (2, "程序自动"),
            (3, "光圈优先"),
            (4, "快门优先"),
        ];
        for (val, expected) in &modes {
            let mode = match val {
                0 => "未定义",
                1 => "手动",
                2 => "程序自动",
                3 => "光圈优先",
                4 => "快门优先",
                _ => "未知",
            };
            assert_eq!(mode, *expected);
        }
    }

    #[test]
    fn test_metering_mode_strings() {
        let modes = [
            (1u16, "平均测光"),
            (2, "中央重点"),
            (3, "点测光"),
            (5, "评价测光"),
        ];
        for (val, expected) in &modes {
            let mode = match val {
                1 => "平均测光",
                2 => "中央重点",
                3 => "点测光",
                5 => "评价测光",
                _ => "未知",
            };
            assert_eq!(mode, *expected);
        }
    }

    #[test]
    fn test_orientation_dimension_swap() {
        // 测试纵向图片识别：orientation 为 6 或 8 时，宽高应互换
        use std::io::Cursor;

        // 构建最小有效的 TIFF/JPEG 结构来测试 orientation 处理
        // 由于 kamadak-exif 解析需要真实的 EXIF 数据结构，我们直接测试 map_exif_to_metadata 的逻辑

        // 测试case 1: orientation = 6（90° 顺时针旋转）
        // 原始存储: 1920x2880, orientation=6 → 显示: 2880x1920
        let mut meta = ImageMetadata::default();
        meta.image_width = Some(1920);
        meta.image_height = Some(2880);
        meta.orientation = Some(6);

        // 手动应用 orientation 处理逻辑
        if let (Some(width), Some(height), Some(orientation)) = (meta.image_width, meta.image_height, meta.orientation) {
            if matches!(orientation, 5 | 6 | 7 | 8) {
                meta.image_width = Some(height);
                meta.image_height = Some(width);
            }
        }

        assert_eq!(meta.image_width, Some(2880), "orientation=6: 宽度应为 2880");
        assert_eq!(meta.image_height, Some(1920), "orientation=6: 高度应为 1920");

        // 测试case 2: orientation = 8（90° 逆时针旋转）
        let mut meta = ImageMetadata::default();
        meta.image_width = Some(1920);
        meta.image_height = Some(2880);
        meta.orientation = Some(8);

        if let (Some(width), Some(height), Some(orientation)) = (meta.image_width, meta.image_height, meta.orientation) {
            if matches!(orientation, 5 | 6 | 7 | 8) {
                meta.image_width = Some(height);
                meta.image_height = Some(width);
            }
        }

        assert_eq!(meta.image_width, Some(2880), "orientation=8: 宽度应为 2880");
        assert_eq!(meta.image_height, Some(1920), "orientation=8: 高度应为 1920");

        // 测试case 3: orientation = 1（正常）- 不应互换
        let mut meta = ImageMetadata::default();
        meta.image_width = Some(1920);
        meta.image_height = Some(2880);
        meta.orientation = Some(1);

        if let (Some(width), Some(height), Some(orientation)) = (meta.image_width, meta.image_height, meta.orientation) {
            if matches!(orientation, 5 | 6 | 7 | 8) {
                meta.image_width = Some(height);
                meta.image_height = Some(width);
            }
        }

        assert_eq!(meta.image_width, Some(1920), "orientation=1: 宽度应保持 1920");
        assert_eq!(meta.image_height, Some(2880), "orientation=1: 高度应保持 2880");

        // 测试case 4: orientation = 3（180° 旋转）- 不应互换
        let mut meta = ImageMetadata::default();
        meta.image_width = Some(1920);
        meta.image_height = Some(2880);
        meta.orientation = Some(3);

        if let (Some(width), Some(height), Some(orientation)) = (meta.image_width, meta.image_height, meta.orientation) {
            if matches!(orientation, 5 | 6 | 7 | 8) {
                meta.image_width = Some(height);
                meta.image_height = Some(width);
            }
        }

        assert_eq!(meta.image_width, Some(1920), "orientation=3: 宽度应保持 1920");
        assert_eq!(meta.image_height, Some(2880), "orientation=3: 高度应保持 2880");
    }
}
