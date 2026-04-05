//! 处理流水线 Commands
//!
//! 实现完整的 6 阶段流水线：
//! Scanning → Processing → Analyzing → Grouping → FocusScoring(异步后台) → Completed
//! 返回 GroupResult。

use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use chrono::NaiveDateTime;
use tauri::Emitter;
use tokio::sync::Semaphore;

use crate::core::bird_detection;
use crate::core::focus_score;
use crate::core::focus_score::FocusScoringMethod;
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

    // ═══════════════════════════════════════════════════════
    // 异步阶段 6: FocusScoring — 后台计算合焦程度
    // ═══════════════════════════════════════════════════════
    // 启动后台任务，不阻塞主流程返回
    {
        let app = app.clone();
        let results = results.clone();
        let pipeline_start = Instant::now(); // 重置计时器用于 FocusScoring 阶段

        tokio::spawn(async move {
            if let Err(e) = compute_focus_scores_background(&app, &results, total, &pipeline_start)
                .await
            {
                log::error!("后台合焦评分失败: {}", e);
            }
        });
    }

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

/// 异步后台计算合焦程度评分
///
/// 在单独的任务中计算所有图片的合焦评分，并定期发送进度事件。
/// 完成后发送 "focus-scores-completed" 事件。
async fn compute_focus_scores_background(
    app: &tauri::AppHandle,
    results: &[ProcessResult],
    total: usize,
    focus_scoring_start: &Instant,
) -> Result<(), String> {
    if results.is_empty() {
        return Ok(());
    }

    // 并发计算配置
    let max_concurrency = std::cmp::min(4, num_cpus::get()); // 限制在 4 个并发
    let semaphore = Arc::new(Semaphore::new(max_concurrency));
    let mut join_set = tokio::task::JoinSet::new();

    // 发出 FocusScoring 阶段开始事件
    emit_progress(
        app,
        ProcessingState::FocusScoring,
        0,
        total,
        None,
        focus_scoring_start,
    );

    // 为每个结果生成任务
    for (idx, result) in results.iter().enumerate() {
        let sem = Arc::clone(&semaphore);
        let hash = result.hash.clone();
        let medium_path = PathBuf::from(&result.medium_path);
        let filename = result.filename.clone();

        join_set.spawn(async move {
            let _permit = sem.acquire().await.ok();

            // CPU 密集型操作在 blocking 线程中执行
            let hash_clone = hash.clone();
            let medium_path_clone = medium_path.clone();
            let result = tokio::task::spawn_blocking(move || {
                // 1. 鸟类检测
                let detection = bird_detection::detect_birds(&medium_path_clone);
                let (best_bbox, all_bboxes) = match detection {
                    Ok(result) if !result.bboxes.is_empty() => {
                        // 取置信度最高的框用于评分
                        let best = result.bboxes.iter()
                            .max_by(|a, b| a.confidence.partial_cmp(&b.confidence).unwrap_or(std::cmp::Ordering::Equal))
                            .cloned();
                        (best, result.bboxes)
                    }
                    Ok(result) => (None, result.bboxes),
                    Err(e) => {
                        log::warn!("鸟类检测失败 {}: {}", medium_path_clone.display(), e);
                        (None, vec![])
                    }
                };

                // 2. 区域合焦评分
                let (score, method) = focus_score::calculate_focus_score_with_bbox(
                    &medium_path_clone,
                    best_bbox.as_ref(),
                ).unwrap_or((None, FocusScoringMethod::Undetected));

                (score, method, all_bboxes)
            })
            .await
            .map_err(|e| format!("任务失败: {}", e));

            (idx, hash_clone, result, filename)
        });
    }

    // 流式收集结果，每完成一张立即 emit
    let mut completed = 0usize;

    while let Some(join_result) = join_set.join_next().await {
        match join_result {
            Ok((_idx, hash, Ok((score, method, bboxes)), filename)) => {
                completed += 1;
                let _ = app.emit("focus-score-update", serde_json::json!({
                    "hash": &hash,
                    "score": score,
                    "method": method,
                    "detectionBboxes": bboxes,
                }));
                emit_progress(
                    app,
                    ProcessingState::FocusScoring,
                    completed,
                    total,
                    Some(filename),
                    focus_scoring_start,
                );
            }
            Ok((_idx, hash, Err(err), _filename)) => {
                completed += 1;
                log::warn!("计算 {} 的合焦评分失败: {}", hash, err);
                let _ = app.emit("focus-score-update", serde_json::json!({
                    "hash": &hash,
                    "score": null,
                    "method": "Undetected",
                }));
                emit_progress(
                    app,
                    ProcessingState::FocusScoring,
                    completed,
                    total,
                    None,
                    focus_scoring_start,
                );
            }
            Err(join_err) => {
                completed += 1;
                log::warn!("合焦评分任务错误: {}", join_err);
                emit_progress(
                    app,
                    ProcessingState::FocusScoring,
                    completed,
                    total,
                    None,
                    focus_scoring_start,
                );
            }
        }
    }

    // 发送完成事件
    let final_progress = ProcessingProgress {
        state: ProcessingState::FocusScoring,
        current: total,
        total,
        progress_percent: 100.0,
        message: Some("合焦评分完成".to_string()),
        current_file: None,
        elapsed_ms: Some(focus_scoring_start.elapsed().as_secs_f64() * 1000.0),
        estimated_remaining_ms: None,
    };
    let _ = app.emit("processing-progress", &final_progress);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use std::sync::atomic::{AtomicUsize, Ordering};

    /// 测试 5.8：metadata_cache 并发写入不 panic（多线程同时更新不同 hash）
    #[test]
    fn test_concurrent_metadata_cache_writes() {
        let cache = Arc::new(Mutex::new(std::collections::HashMap::new()));
        let mut handles = vec![];

        for i in 0..8 {
            let cache_clone = Arc::clone(&cache);
            let handle = std::thread::spawn(move || {
                for j in 0..100 {
                    let hash = format!("hash_{}_{}", i, j);
                    let mut cache_guard = cache_clone.lock().unwrap();
                    cache_guard.insert(hash, i * 100 + j);
                }
            });
            handles.push(handle);
        }

        for handle in handles {
            handle.join().unwrap();
        }

        let final_cache = cache.lock().unwrap();
        assert_eq!(final_cache.len(), 800, "应该有 800 个不同的 hash");
    }

    /// 测试 5.9：focus-score-update 事件 payload 格式验证（包含 detectionBboxes）
    #[test]
    fn test_focus_score_update_payload_format() {
        // 模拟 emit 事件的 JSON payload（完整版本包含 detectionBboxes）
        let hash = "abc123def456789".to_string();
        let score = Some(5u32);
        let method = FocusScoringMethod::BirdRegion;
        let bboxes = vec![
            crate::core::bird_detection::DetectionBox::new(0.1, 0.2, 0.8, 0.9, 0.95),
        ];

        let payload = serde_json::json!({
            "hash": &hash,
            "score": score,
            "method": method,
            "detectionBboxes": bboxes,
        });

        // 验证 payload 结构（包含所有必需字段）
        assert!(payload.is_object());
        assert_eq!(payload["hash"], "abc123def456789");
        assert_eq!(payload["score"], 5);
        assert_eq!(payload["method"], "BirdRegion");
        assert!(payload["detectionBboxes"].is_array());
        assert_eq!(payload["detectionBboxes"].as_array().unwrap().len(), 1);

        // 测试 Undetected 情况（无检测框）
        let empty_bboxes: Vec<crate::core::bird_detection::DetectionBox> = vec![];
        let payload_undetected = serde_json::json!({
            "hash": "hash_xyz",
            "score": serde_json::Value::Null,
            "method": FocusScoringMethod::Undetected,
            "detectionBboxes": empty_bboxes,
        });

        assert_eq!(payload_undetected["score"], serde_json::Value::Null);
        assert_eq!(payload_undetected["method"], "Undetected");
        assert!(payload_undetected["detectionBboxes"].as_array().unwrap().is_empty());
    }

    /// 测试 5.7 辅助：Semaphore 并发限制的基本功能
    #[test]
    fn test_semaphore_concurrency_limit() {
        use tokio::sync::Semaphore;
        
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let max_concurrency = 4;
            let semaphore = Arc::new(Semaphore::new(max_concurrency));
            let counter = Arc::new(AtomicUsize::new(0));
            let max_concurrent = Arc::new(AtomicUsize::new(0));

            let mut join_set = tokio::task::JoinSet::new();

            for _ in 0..20 {
                let sem = Arc::clone(&semaphore);
                let counter_clone = Arc::clone(&counter);
                let max_concurrent_clone = Arc::clone(&max_concurrent);

                join_set.spawn(async move {
                    let _permit = sem.acquire().await.ok();
                    
                    let current = counter_clone.fetch_add(1, Ordering::SeqCst) + 1;
                    
                    // 更新最大并发数
                    loop {
                        let max = max_concurrent_clone.load(Ordering::SeqCst);
                        if current <= max || max_concurrent_clone.compare_exchange(
                            max,
                            current,
                            Ordering::SeqCst,
                            Ordering::SeqCst,
                        ).is_ok() {
                            break;
                        }
                    }

                    tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
                    counter_clone.fetch_sub(1, Ordering::SeqCst);
                });
            }

            while let Some(_) = join_set.join_next().await {}

            let max_observed = max_concurrent.load(Ordering::SeqCst);
            assert!(
                max_observed <= max_concurrency,
                "最大并发数 {} 应不超过限制 {}",
                max_observed,
                max_concurrency
            );
        });
    }
}

