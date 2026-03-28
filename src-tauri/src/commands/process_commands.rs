//! 处理流水线 Commands
//!
//! 实现完整的 5 阶段流水线：
//! Scanning → Processing → Analyzing → Grouping → Completed
//! 返回 GroupResult。

use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tokio::sync::Semaphore;

use crate::core::grouping::{self, ImageInfoWithPhash};
use crate::core::phash;
use crate::core::raw_processor::{self, ProcessResult};
use crate::models::{GroupResult, PerformanceMetrics, ProcessingProgress, ProcessingState};
use crate::state::SessionState;
use crate::utils::cache;

/// 获取最大并发处理数（根据 CPU 核数动态调整）
fn get_max_concurrency() -> usize {
    let cpu_count = num_cpus::get();
    // 2x CPU 核数，但不超过 16
    std::cmp::min(cpu_count * 2, 16)
}

/// 处理文件夹的返回结果（保留用于兼容，内部使用 GroupResult）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessFolderResult {
    pub total_files: usize,
    pub processed: usize,
    pub failed: usize,
    pub failed_files: Vec<String>,
    pub results: Vec<ProcessResult>,
}

/// 处理文件夹：完整 5 阶段流水线
///
/// Scanning → Processing → Analyzing → Grouping → Completed
///
/// 返回 GroupResult（BREAKING：原返回 ProcessFolderResult）
#[tauri::command]
pub async fn process_folder(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<Mutex<SessionState>>>,
    folder_path: String,
    similarity_threshold: Option<f64>,
    time_gap_seconds: Option<u64>,
) -> Result<GroupResult, String> {
    let pipeline_start = Instant::now();

    // 重置状态
    {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        s.reset();
        s.current_folder = Some(PathBuf::from(&folder_path));
        s.processing_state = ProcessingState::Scanning;
    }

    // ═══════════════════════════════════════════════════════
    // 阶段 1: Scanning — 扫描 NEF 文件
    // ═══════════════════════════════════════════════════════
    emit_progress(&app, ProcessingState::Scanning, 0, 0, None, &pipeline_start);

    let scan_start = Instant::now();
    let nef_files = scan_nef_files(Path::new(&folder_path)).map_err(|e| e.to_string())?;
    let total = nef_files.len();
    let scan_time_ms = scan_start.elapsed().as_secs_f64() * 1000.0;


    println!("[process_folder] 扫描到 {} 个 NEF 文件", total);

    if total == 0 {
        let empty_result = GroupResult {
            groups: vec![],
            total_images: 0,
            total_groups: 0,
            processed_files: 0,
            performance: PerformanceMetrics {
                total_time_ms: pipeline_start.elapsed().as_secs_f64() * 1000.0,
                scan_time_ms,
                process_time_ms: 0.0,
                similarity_time_ms: 0.0,
                grouping_time_ms: 0.0,
            },
        };

        let mut s = state.lock().map_err(|e| e.to_string())?;
        s.processing_state = ProcessingState::Completed;
        s.group_result = Some(empty_result.clone());

        emit_progress(&app, ProcessingState::Completed, 0, 0, None, &pipeline_start);
        let _ = app.emit("processing-completed", &empty_result);

        return Ok(empty_result);
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

    // ═══════════════════════════════════════════════════════
    // 阶段 2: Processing — 提取 JPEG + Exif + 缩略图
    // ═══════════════════════════════════════════════════════
    {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        s.processing_state = ProcessingState::Processing;
    }

    let cancel_flag = {
        let s = state.lock().map_err(|e| e.to_string())?;
        Arc::clone(&s.cancel_flag)
    };

    let process_start = Instant::now();
    let max_concurrency = get_max_concurrency();
    let semaphore = Arc::new(Semaphore::new(max_concurrency));
    let mut join_set = tokio::task::JoinSet::new();

    println!("[process_folder] 阶段2开始: nef_files={}, cancel_flag={}", nef_files.len(), cancel_flag.load(Ordering::Relaxed));

    for file_path in &nef_files {
        if cancel_flag.load(Ordering::Relaxed) {
            println!("[process_folder] spawn 循环中检测到取消, 已 spawn {} 个任务", join_set.len());
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

    // 流式收集结果
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
                emit_progress(
                    &app,
                    ProcessingState::Processing,
                    current,
                    total,
                    filename,
                    &pipeline_start,
                );
            }
            Ok((file_path, Err(err_msg))) => {
                failed_files.push(err_msg);
                let current = results.len() + failed_files.len();
                let filename = file_path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string());
                emit_progress(
                    &app,
                    ProcessingState::Processing,
                    current,
                    total,
                    filename,
                    &pipeline_start,
                );
            }
            Err(join_err) => {
                failed_files.push(format!("JoinError: {}", join_err));
                let current = results.len() + failed_files.len();
                emit_progress(
                    &app,
                    ProcessingState::Processing,
                    current,
                    total,
                    None,
                    &pipeline_start,
                );
            }
        }
    }

    let process_time_ms = process_start.elapsed().as_secs_f64() * 1000.0;
    println!("[process_folder] 阶段2完成: results={}, failed={}, processed={}, cancel_flag={}", results.len(), failed_files.len(), processed, cancel_flag.load(Ordering::Relaxed));
    if !failed_files.is_empty() {
        for (i, f) in failed_files.iter().enumerate().take(3) {
            println!("[process_folder] failed[{}]: {}", i, f);
        }
    }

    // 检查取消
    if cancel_flag.load(Ordering::Relaxed) {
        return handle_cancelled(&app, &state, &results, total, &pipeline_start, scan_time_ms, process_time_ms);
    }

    // 更新 SessionState 映射
    {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        update_session_mappings(&mut s, &results);
    }

    // ═══════════════════════════════════════════════════════
    // 阶段 3: Analyzing — 排序 + 并发计算 pHash
    // ═══════════════════════════════════════════════════════
    {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        s.processing_state = ProcessingState::Analyzing;
    }

    let analyzing_start = Instant::now();

    // 按 (capture_time, filename) 排序
    results.sort_by(|a, b| {
        let time_a = &a.metadata.capture_time;
        let time_b = &b.metadata.capture_time;
        match (time_a, time_b) {
            (Some(ta), Some(tb)) => ta.cmp(tb).then(a.filename.cmp(&b.filename)),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => a.filename.cmp(&b.filename),
        }
    });

    // 并发计算 pHash
    let phash_total = results.len();
    let phash_semaphore = Arc::new(Semaphore::new(max_concurrency));
    let mut phash_join_set = tokio::task::JoinSet::new();

    for (idx, result) in results.iter().enumerate() {
        if cancel_flag.load(Ordering::Relaxed) {
            break;
        }

        let sem = Arc::clone(&phash_semaphore);
        let cancel = Arc::clone(&cancel_flag);
        let thumbnail_path = PathBuf::from(&result.thumbnail_path);
        let hash = result.hash.clone();

        phash_join_set.spawn(async move {
            let _permit = sem.acquire().await.unwrap();

            if cancel.load(Ordering::Relaxed) {
                return (idx, hash, Err("已取消".to_string()));
            }

            // pHash 计算是 CPU 密集型，在 blocking 线程中执行
            let path = thumbnail_path.clone();
            let phash_result = tokio::task::spawn_blocking(move || {
                phash::compute_phash(&path)
            })
            .await
            .map_err(|e| format!("pHash 计算任务失败: {}", e))
            .and_then(|r| r.map_err(|e| format!("pHash 计算失败: {}", e)));

            (idx, hash, phash_result)
        });
    }

    // 收集 pHash 结果
    let mut phash_results: Vec<(usize, String, u64)> = Vec::with_capacity(phash_total);
    let mut phash_completed = 0usize;

    while let Some(join_result) = phash_join_set.join_next().await {
        match join_result {
            Ok((idx, hash, Ok(phash_val))) => {
                phash_completed += 1;
                phash_results.push((idx, hash, phash_val));
                let filename = results.get(idx).map(|r| r.filename.clone());
                emit_progress(
                    &app,
                    ProcessingState::Analyzing,
                    phash_completed,
                    phash_total,
                    filename,
                    &pipeline_start,
                );
            }
            Ok((_idx, _hash, Err(err))) => {
                phash_completed += 1;
                log::warn!("pHash 计算跳过: {}", err);
                emit_progress(
                    &app,
                    ProcessingState::Analyzing,
                    phash_completed,
                    phash_total,
                    None,
                    &pipeline_start,
                );
            }
            Err(join_err) => {
                phash_completed += 1;
                log::warn!("pHash JoinError: {}", join_err);
                emit_progress(
                    &app,
                    ProcessingState::Analyzing,
                    phash_completed,
                    phash_total,
                    None,
                    &pipeline_start,
                );
            }
        }
    }

    let similarity_time_ms = analyzing_start.elapsed().as_secs_f64() * 1000.0;

    // 检查取消
    if cancel_flag.load(Ordering::Relaxed) {
        return handle_cancelled(&app, &state, &results, total, &pipeline_start, scan_time_ms, process_time_ms);
    }

    // 将 pHash 结果写入 SessionState
    {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        for (_, hash, phash_val) in &phash_results {
            s.phash_cache.insert(hash.clone(), *phash_val);
        }
    }

    // 构建用于分组的 pHash 映射
    let phash_map: std::collections::HashMap<String, u64> = phash_results
        .iter()
        .map(|(_, hash, phash_val)| (hash.clone(), *phash_val))
        .collect();

    // ═══════════════════════════════════════════════════════
    // 阶段 4: Grouping — 执行分组算法
    // ═══════════════════════════════════════════════════════
    {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        s.processing_state = ProcessingState::Grouping;
    }

    emit_progress(
        &app,
        ProcessingState::Grouping,
        0,
        1,
        None,
        &pipeline_start,
    );

    let grouping_start = Instant::now();

    // 构建 ImageInfoWithPhash 列表（保持排序顺序）
    let image_infos: Vec<ImageInfoWithPhash> = results
        .iter()
        .filter_map(|r| {
            let phash_val = phash_map.get(&r.hash)?;
            Some(ImageInfoWithPhash {
                hash: r.hash.clone(),
                phash: *phash_val,
                filename: r.filename.clone(),
                file_path: r.file_path.clone(),
                capture_time: r.metadata.capture_time.as_ref().and_then(|t| {
                    parse_capture_time(t)
                }),
                thumbnail_path: r.thumbnail_path.clone(),
            })
        })
        .collect();

    println!("[process_folder] results.len()={}, phash_results.len()={}, image_infos.len()={}", results.len(), phash_results.len(), image_infos.len());

    let threshold = similarity_threshold.unwrap_or(90.0);
    let time_gap = time_gap_seconds.map(|t| t as i64).unwrap_or(10);

    let groups = grouping::group_images_with_phash(
        &image_infos,
        Some(threshold),
        Some(time_gap),
    );

    let grouping_time_ms = grouping_start.elapsed().as_secs_f64() * 1000.0;

    emit_progress(
        &app,
        ProcessingState::Grouping,
        1,
        1,
        None,
        &pipeline_start,
    );

    // ═══════════════════════════════════════════════════════
    // 阶段 5: Completed — 构建结果
    // ═══════════════════════════════════════════════════════
    let total_time_ms = pipeline_start.elapsed().as_secs_f64() * 1000.0;

    let group_result = GroupResult {
        total_images: image_infos.len(),
        total_groups: groups.len(),
        processed_files: processed,
        groups,
        performance: PerformanceMetrics {
            total_time_ms,
            scan_time_ms,
            process_time_ms,
            similarity_time_ms,
            grouping_time_ms,
        },
    };

    // 更新 SessionState - 阶段5
    {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        s.group_result = Some(group_result.clone());
        s.processing_state = ProcessingState::Completed;
    }

    // emit 完成事件
    emit_progress(
        &app,
        ProcessingState::Completed,
        total,
        total,
        None,
        &pipeline_start,
    );
    let _ = app.emit("processing-completed", &group_result);

    Ok(group_result)
}

/// 取消正在进行的处理
#[tauri::command]
pub async fn cancel_processing(
    state: tauri::State<'_, Arc<Mutex<SessionState>>>,
) -> Result<(), String> {
    let mut s = state.lock().map_err(|e| e.to_string())?;
    s.cancel_flag.store(true, Ordering::Relaxed);
    let current_state = s.processing_state.clone();
    if current_state == ProcessingState::Processing
        || current_state == ProcessingState::Analyzing
    {
        s.processing_state = ProcessingState::Cancelling;
    }
    Ok(())
}

// ─── 内部辅助函数 ────────────────────────────────────────

/// 处理取消后的清理和返回
fn handle_cancelled(
    app: &tauri::AppHandle,
    state: &tauri::State<'_, Arc<Mutex<SessionState>>>,
    results: &[ProcessResult],
    total: usize,
    pipeline_start: &Instant,
    scan_time_ms: f64,
    process_time_ms: f64,
) -> Result<GroupResult, String> {
    let mut s = state.lock().map_err(|e| e.to_string())?;
    s.processing_state = ProcessingState::Cancelled;
    update_session_mappings(&mut s, results);

    let cancelled_result = GroupResult {
        groups: vec![],
        total_images: 0,
        total_groups: 0,
        processed_files: results.len(),
        performance: PerformanceMetrics {
            total_time_ms: pipeline_start.elapsed().as_secs_f64() * 1000.0,
            scan_time_ms,
            process_time_ms,
            similarity_time_ms: 0.0,
            grouping_time_ms: 0.0,
        },
    };

    s.group_result = Some(cancelled_result.clone());

    emit_progress(
        app,
        ProcessingState::Cancelled,
        total,
        total,
        None,
        pipeline_start,
    );

    Ok(cancelled_result)
}

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

/// 发送处理进度事件（含计时信息）
fn emit_progress(
    app: &tauri::AppHandle,
    processing_state: ProcessingState,
    current: usize,
    total: usize,
    current_file: Option<String>,
    pipeline_start: &Instant,
) {
    let elapsed_ms = pipeline_start.elapsed().as_secs_f64() * 1000.0;

    let progress_percent = if total > 0 {
        (current as f64 / total as f64) * 100.0
    } else {
        0.0
    };

    // 基于当前速率估算剩余时间
    let estimated_remaining_ms = if current > 0 && current < total {
        let rate = elapsed_ms / current as f64;
        Some(rate * (total - current) as f64)
    } else {
        None
    };

    let progress = ProcessingProgress {
        state: processing_state,
        current,
        total,
        progress_percent,
        message: None,
        current_file,
        elapsed_ms: Some(elapsed_ms),
        estimated_remaining_ms,
    };

    let _ = app.emit("processing-progress", &progress);
}

/// 解析拍摄时间字符串为 NaiveDateTime
///
/// 支持多种格式："2024:01:01 12:00:00"、"2024-01-01 12:00:00"、"2024-01-01T12:00:00"
fn parse_capture_time(time_str: &str) -> Option<NaiveDateTime> {
    // Exif 标准格式
    NaiveDateTime::parse_from_str(time_str, "%Y:%m:%d %H:%M:%S")
        .or_else(|_| NaiveDateTime::parse_from_str(time_str, "%Y-%m-%d %H:%M:%S"))
        .or_else(|_| NaiveDateTime::parse_from_str(time_str, "%Y-%m-%dT%H:%M:%S"))
        .ok()
}
