use serde::Serialize;
use std::sync::{Arc, Mutex};

use crate::models::ProcessingState;
use crate::state::SessionState;
use crate::utils::cache;

/// 缓存大小信息
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheSizeInfo {
    pub total_size: u64,
    pub file_count: u64,
    pub cache_dir: String,
}

/// 查询缓存大小和文件数量
#[tauri::command]
pub async fn get_cache_size(
    state: tauri::State<'_, Arc<Mutex<SessionState>>>,
) -> Result<CacheSizeInfo, String> {
    let cache_dir = {
        let session = state.lock().unwrap();
        session.cache_dir.clone()
    };

    let (total_size, file_count) = cache::get_cache_size(&cache_dir).await;

    Ok(CacheSizeInfo {
        total_size,
        file_count,
        cache_dir: cache_dir.to_string_lossy().to_string(),
    })
}

/// 清理所有缓存文件
///
/// 如果当前正在处理中（scanning/processing/analyzing/grouping/focus_scoring/cancelling），
/// 拒绝清理并返回错误，避免与正在写入的缓存文件产生竞争。
#[tauri::command]
pub async fn clear_cache(
    state: tauri::State<'_, Arc<Mutex<SessionState>>>,
) -> Result<(), String> {
    let cache_dir = {
        let session = state.lock().unwrap();
        match &session.processing_state {
            ProcessingState::Idle
            | ProcessingState::Completed
            | ProcessingState::Cancelled
            | ProcessingState::Error => {}
            other => {
                return Err(format!(
                    "无法清理缓存：当前正在处理中（{:?}），请先停止处理",
                    other
                ));
            }
        }
        session.cache_dir.clone()
    };

    cache::clear_all_cache(&cache_dir)
        .await
        .map_err(|e| e.to_string())
}
