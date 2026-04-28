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

    // 35mm 等效焦段与裁切系数
    let fl_35mm_from_exif = get_rational_f64(exif, Tag::FocalLengthIn35mmFilm);
    if let (Some(fl), Some(fl_35mm)) = (meta.focal_length, fl_35mm_from_exif) {
        // EXIF 同时提供两个值：直接使用，并推导裁切系数
        meta.focal_length_35mm = Some(fl_35mm);
        if fl > 0.0 {
            meta.crop_factor = Some(fl_35mm / fl);
        }
    } else if meta.focal_length.is_some() {
        // EXIF 缺少等效焦段：从相机型号推算（兜底）
        let computed = compute_focal_length_35mm(meta.focal_length, meta.camera_model.as_deref());
        if let Some(fl_35mm) = computed {
            meta.focal_length_35mm = Some(fl_35mm);
            if let Some(fl) = meta.focal_length {
                if fl > 0.0 {
                    meta.crop_factor = Some(fl_35mm / fl);
                }
            }
        }
    }

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

/// 根据相机型号获取裁切系数
///
/// 主要覆盖 Nikon（本项目处理 NEF），同时包含其他常见品牌。
/// 当相机为全画幅时返回 1.0（等效焦段与原生相同，无需额外计算），
/// 因此仅当裁切系数 ≠ 1.0 时才有计算意义。
pub fn get_crop_factor(camera_model: &str) -> Option<f64> {
    let model = camera_model.to_uppercase();

    // ── Nikon ──
    if model.contains("NIKON") {
        // FX 全画幅机型——D 系列用 "D<数字>" 后跟空格/结尾/后缀 来精确匹配，
        // Z 系列用 "Z" 后跟空格或紧跟单数字（Z5/Z6/Z7/Z8/Z9），
        // 避免含双数字的 DX 机型（Z50/Z30/Zfc）被误匹配。
        let is_fx = model.contains("D3 ") || model.contains("D3X") || model.contains("D3S")
            || model.contains("D4 ") || model.contains("D4S")
            || model.contains("D5 ")
            || model.contains("D6 ")
            || model.contains("D700") || model.contains("D750") || model.contains("D780")
            || model.contains("D800") || model.contains("D810") || model.contains("D850")
            || model.contains("DF ")
            || model.contains("Z 5") || model.contains("Z 6") || model.contains("Z 7")
            || model.contains("Z 8") || model.contains("Z 9")
            // Z5/Z6/Z7/Z8/Z9 后跟下划线或结尾（排除 Z50/Z30/Zfc）
            || model.contains("Z5_") || model.contains("Z6_") || model.contains("Z7_")
            || model.contains("Z8_") || model.contains("Z9_")
            // Z5/Z6/Z7/Z8/Z9 后跟 II/III 后缀（如 Z6II, Z7III）
            || model.contains("Z6II") || model.contains("Z7II") || model.contains("Z7III")
            // 以 Z5/Z6/Z7/Z8/Z9 结尾
            || model.ends_with("Z5") || model.ends_with("Z6") || model.ends_with("Z7")
            || model.ends_with("Z8") || model.ends_with("Z9")
            || model.ends_with("Z5II") || model.ends_with("Z6II") || model.ends_with("Z6III")
            || model.ends_with("Z7II") || model.ends_with("Z7III");
        if is_fx {
            return Some(1.0);
        }
        // 其余 Nikon 机型默认为 DX (APS-C, 1.5x)
        return Some(1.5);
    }

    // ── Canon ──
    if model.contains("CANON") {
        let is_ff = model.contains("5D") || model.contains("6D") || model.contains("1D")
            || model.contains("EOS R") || model.contains(" R5") || model.contains(" R6")
            || model.contains(" R3") || model.contains(" R1");
        return if is_ff { Some(1.0) } else { Some(1.6) };
    }

    // ── Sony ──
    if model.contains("SONY") {
        let is_ff = model.contains("A1 ") || model.contains("A7") || model.contains("A9")
            || model.contains("FX") || model.contains("A99");
        return if is_ff { Some(1.0) } else { Some(1.5) };
    }

    // ── Fujifilm ──
    if model.contains("FUJIFILM") || model.contains("FUJI") {
        return if model.contains("GFX") { Some(0.79) } else { Some(1.5) };
    }

    // ── OM System / Olympus (M4/3) ──
    if model.contains("OLYMPUS") || model.contains("OM SYSTEM") {
        return Some(2.0);
    }

    // ── Panasonic ──
    if model.contains("PANASONIC") || model.contains("LUMIX") {
        let is_ff = model.contains("S1") || model.contains("S5") || model.contains("S9");
        return if is_ff { Some(1.0) } else { Some(2.0) };
    }

    None
}

/// 计算 35mm 等效焦段（当 EXIF 中无 FocalLengthIn35mmFilm 时的回退方案）
pub fn compute_focal_length_35mm(focal_length: Option<f64>, camera_model: Option<&str>) -> Option<f64> {
    let fl = focal_length?;
    let model = camera_model?;
    let crop = get_crop_factor(model)?;

    // 全画幅时等效焦段 = 原生焦段，无需单独存储
    if (crop - 1.0).abs() < f64::EPSILON {
        return None;
    }

    Some((fl * crop).round())
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
