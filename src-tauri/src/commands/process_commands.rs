//! 处理流水线 Commands
//!
//! 实现 process_folder（扫描→并发处理→更新状态→推送进度）和 cancel_processing。

use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tokio::sync::Semaphore;

use crate::core::raw_processor::{self, ProcessResult};
use crate::models::{ProcessingProgress, ProcessingState};
use crate::state::SessionState;
use crate::utils::cache;

/// 最大并发处理数
const MAX_CONCURRENCY: usize = 8;

/// 处理文件夹的返回结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessFolderResult {
    pub total_files: usize,
    pub processed: usize,
    pub failed: usize,
    pub failed_files: Vec<String>,
    pub results: Vec<ProcessResult>,
}

/// 处理文件夹：扫描 NEF → 并发处理 → 更新 SessionState → emit 进度事件 → 返回结果
#[tauri::command]
pub async fn process_folder(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<Mutex<SessionState>>>,
    folder_path: String,
    _similarity_threshold: Option<f64>,
    _time_gap_seconds: Option<u64>,
) -> Result<ProcessFolderResult, String> {
    // 重置状态
    {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        s.reset();
        s.current_folder = Some(PathBuf::from(&folder_path));
        s.processing_state = ProcessingState::Scanning;
    }

    // 发送扫描状态
    emit_progress(&app, ProcessingState::Scanning, 0, 0, None);

    // 扫描 NEF 文件
    let nef_files = scan_nef_files(Path::new(&folder_path)).map_err(|e| e.to_string())?;
    let total = nef_files.len();

    if total == 0 {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        s.processing_state = ProcessingState::Completed;
        return Ok(ProcessFolderResult {
            total_files: 0,
            processed: 0,
            failed: 0,
            failed_files: vec![],
            results: vec![],
        });
    }

    // 获取缓存目录
    let cache_dir = {
        let s = state.lock().map_err(|e| e.to_string())?;
        s.cache_dir.clone()
    };

    // 确保缓存目录存在
    cache::ensure_cache_dirs(&cache_dir)
        .await
        .map_err(|e| e.to_string())?;

    // 更新状态为 Processing
    {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        s.processing_state = ProcessingState::Processing;
    }

    // 获取 cancel_flag 引用
    let cancel_flag = {
        let s = state.lock().map_err(|e| e.to_string())?;
        Arc::clone(&s.cancel_flag)
    };

    // 并发处理：使用 JoinSet + Semaphore 控制并发度
    // JoinSet 会在任何一个 task 完成时立即返回，实现真正的流式进度
    let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENCY));
    let mut join_set = tokio::task::JoinSet::new();

    for file_path in &nef_files {
        if cancel_flag.load(Ordering::Relaxed) {
            break;
        }

        let sem = Arc::clone(&semaphore);
        let cancel = Arc::clone(&cancel_flag);
        let path = file_path.clone();
        let cache = cache_dir.clone();

        join_set.spawn(async move {
            let _permit = sem.acquire().await.unwrap();

            if cancel.load(Ordering::Relaxed) {
                return (path.clone(), Err(format!("已取消: {}", path.display())));
            }

            let result = raw_processor::process_single_raw(&path, &cache)
                .await
                .map_err(|e| format!("{}: {}", path.display(), e));

            (path, result)
        });
    }

    // 流式收集结果：每完成一个就发送进度
    let mut results = Vec::with_capacity(total);
    let mut failed_files = Vec::new();
    let mut processed = 0usize;

    while let Some(join_result) = join_set.join_next().await {
        match join_result {
            Ok((file_path, Ok(result))) => {
                processed += 1;
                let filename = file_path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string());
                results.push(result);
                let current = results.len() + failed_files.len();
                emit_progress(&app, ProcessingState::Processing, current, total, filename);
            }
            Ok((file_path, Err(err_msg))) => {
                failed_files.push(err_msg);
                let current = results.len() + failed_files.len();
                let filename = file_path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string());
                emit_progress(&app, ProcessingState::Processing, current, total, filename);
            }
            Err(join_err) => {
                failed_files.push(format!("JoinError: {}", join_err));
                let current = results.len() + failed_files.len();
                emit_progress(&app, ProcessingState::Processing, current, total, None);
            }
        }
    }

    // 检查是否被取消
    if cancel_flag.load(Ordering::Relaxed) {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        s.processing_state = ProcessingState::Cancelled;
        // 仍然更新已完成部分的映射
        update_session_mappings(&mut s, &results);
        return Ok(ProcessFolderResult {
            total_files: total,
            processed,
            failed: failed_files.len(),
            failed_files,
            results,
        });
    }

    // 更新 SessionState 映射
    {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        update_session_mappings(&mut s, &results);
        s.processing_state = ProcessingState::Completed;
    }

    // 发送完成事件
    emit_progress(&app, ProcessingState::Completed, total, total, None);

    Ok(ProcessFolderResult {
        total_files: total,
        processed,
        failed: failed_files.len(),
        failed_files,
        results,
    })
}

/// 取消正在进行的处理
#[tauri::command]
pub async fn cancel_processing(
    state: tauri::State<'_, Arc<Mutex<SessionState>>>,
) -> Result<(), String> {
    let mut s = state.lock().map_err(|e| e.to_string())?;
    s.cancel_flag.store(true, Ordering::Relaxed);
    if s.processing_state == ProcessingState::Processing {
        s.processing_state = ProcessingState::Cancelling;
    }
    Ok(())
}

// ─── 内部辅助函数 ────────────────────────────────────────

/// 扫描文件夹中的 NEF 文件（非递归，大小写不敏感）
fn scan_nef_files(folder: &Path) -> Result<Vec<PathBuf>, std::io::Error> {
    let mut files = Vec::new();
    for entry in std::fs::read_dir(folder)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext.to_string_lossy().to_lowercase() == "nef" {
                    files.push(path);
                }
            }
        }
    }
    Ok(files)
}

/// 更新 SessionState 的双向映射和元数据缓存
fn update_session_mappings(state: &mut SessionState, results: &[ProcessResult]) {
    for r in results {
        state
            .filename_hash_map
            .insert(r.filename.clone(), r.hash.clone());
        state
            .hash_filename_map
            .insert(r.hash.clone(), r.filename.clone());
        state
            .hash_path_map
            .insert(r.hash.clone(), PathBuf::from(&r.file_path));
        state
            .metadata_cache
            .insert(r.hash.clone(), r.metadata.clone());
    }
}

/// 发送处理进度事件
fn emit_progress(
    app: &tauri::AppHandle,
    processing_state: ProcessingState,
    current: usize,
    total: usize,
    current_file: Option<String>,
) {
    let progress_percent = if total > 0 {
        (current as f64 / total as f64) * 100.0
    } else {
        0.0
    };

    let progress = ProcessingProgress {
        state: processing_state,
        current,
        total,
        progress_percent,
        message: None,
        current_file,
        elapsed_ms: None,
        estimated_remaining_ms: None,
    };

    let _ = app.emit("processing-progress", &progress);
}
