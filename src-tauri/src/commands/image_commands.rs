//! 图片查询 Commands
//!
//! 提供 get_image_url、get_metadata、get_batch_metadata 命令。

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use crate::models::{AppError, ImageMetadata};
use crate::state::SessionState;
use crate::utils::paths::get_cache_file_path;
use tauri_plugin_opener::OpenerExt;

/// 获取图片缓存文件路径
///
/// 根据 hash 和 size（"medium" | "thumbnail" | "original"）构建缓存文件路径，
/// 验证文件存在后返回。前端通过 `convertFileSrc` 转为 `asset://` URL。
///
/// size="original" 时按需提取：若缓存不存在，从源文件提取嵌入 JPEG 原尺寸并写入缓存。
#[tauri::command]
pub async fn get_image_url(
    state: tauri::State<'_, Arc<Mutex<SessionState>>>,
    hash: String,
    size: Option<String>,
) -> Result<String, String> {
    let size = size.unwrap_or_else(|| "thumbnail".to_string());

    let (cache_dir, file_path) = {
        let s = state.lock().map_err(|e| e.to_string())?;
        let cache_dir = s.cache_dir.clone();
        let file_path = s.hash_path_map.get(&hash).cloned();
        (cache_dir, file_path)
    };

    if size == "original" {
        let file_path = file_path.ok_or_else(|| {
            format!("未找到 hash '{}' 对应的源文件路径", hash)
        })?;

        let path: PathBuf = crate::core::raw_processor::extract_original_jpeg(
            &file_path, &hash, &cache_dir,
        )
        .await
        .map_err(|e: AppError| e.to_string())?;

        return Ok(path.to_string_lossy().to_string());
    }

    if size != "medium" && size != "thumbnail" {
        return Err(format!(
            "无效的 size 参数: {}, 期望 'medium'、'thumbnail' 或 'original'",
            size
        ));
    }

    let path = get_cache_file_path(&cache_dir, &hash, &size);

    if !path.exists() {
        log::warn!(
            "缓存文件不存在: {} (cache_dir: {})",
            path.display(),
            cache_dir.display()
        );
        return Err(
            AppError::FileNotFound(format!("缓存文件不存在: {}", path.display())).to_string(),
        );
    }

    let result = path.to_string_lossy().to_string();
    Ok(result)
}

/// 获取单张图片的元数据
#[tauri::command]
pub async fn get_metadata(
    state: tauri::State<'_, Arc<Mutex<SessionState>>>,
    hash: String,
) -> Result<ImageMetadata, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    s.metadata_cache
        .get(&hash)
        .cloned()
        .ok_or_else(|| format!("未找到 hash '{}' 对应的元数据", hash))
}

/// 批量获取元数据，跳过不存在的 hash
#[tauri::command]
pub async fn get_batch_metadata(
    state: tauri::State<'_, Arc<Mutex<SessionState>>>,
    hashes: Vec<String>,
) -> Result<HashMap<String, ImageMetadata>, String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let mut result = HashMap::new();

    for hash in &hashes {
        if let Some(meta) = s.metadata_cache.get(hash) {
            result.insert(hash.clone(), meta.clone());
        }
    }

    Ok(result)
}

/// 用系统默认程序打开原图
///
/// 直接打开源文件（NEF/CR2 等 RAW 或 JPEG），由系统关联程序处理。
#[tauri::command]
pub async fn open_original(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<Mutex<SessionState>>>,
    hash: String,
) -> Result<(), String> {
    let file_path = {
        let s = state.lock().map_err(|e| e.to_string())?;
        s.hash_path_map.get(&hash).cloned()
    };

    let file_path = file_path.ok_or_else(|| {
        format!("未找到 hash '{}' 对应的源文件路径", hash)
    })?;

    app.opener()
        .open_path(file_path.to_string_lossy().to_string(), None::<String>)
        .map_err(|e| format!("打开文件失败: {}", e))?;

    Ok(())
}
