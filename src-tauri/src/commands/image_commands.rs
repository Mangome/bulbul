//! 图片查询 Commands
//!
//! 提供 get_image_url、get_metadata、get_batch_metadata 命令。

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::models::{AppError, ImageMetadata};
use crate::state::SessionState;
use crate::utils::paths::get_cache_file_path;

/// 获取图片缓存文件路径
///
/// 根据 hash 和 size（"medium" | "thumbnail"）构建缓存文件路径，
/// 验证文件存在后返回。前端通过 `convertFileSrc` 转为 `asset://` URL。
#[tauri::command]
pub async fn get_image_url(
    state: tauri::State<'_, Arc<Mutex<SessionState>>>,
    hash: String,
    size: Option<String>,
) -> Result<String, String> {
    let size = size.unwrap_or_else(|| "thumbnail".to_string());
    if size != "medium" && size != "thumbnail" {
        return Err(format!("无效的 size 参数: {}, 期望 'medium' 或 'thumbnail'", size));
    }

    let cache_dir = {
        let s = state.lock().map_err(|e| e.to_string())?;
        s.cache_dir.clone()
    };

    let path = get_cache_file_path(&cache_dir, &hash, &size);
    if !path.exists() {
        return Err(AppError::FileNotFound(format!(
            "缓存文件不存在: {}",
            path.display()
        ))
        .to_string());
    }

    Ok(path.to_string_lossy().to_string())
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
