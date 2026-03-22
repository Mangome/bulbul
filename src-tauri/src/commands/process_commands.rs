/// 处理文件夹（空壳，Stage 2+ 实现）
#[tauri::command]
pub async fn process_folder(
    _folder_path: String,
    _similarity_threshold: Option<f64>,
    _time_gap_seconds: Option<u64>,
) -> Result<(), String> {
    todo!("process_folder will be implemented in Stage 2+")
}

/// 取消处理（空壳，Stage 2+ 实现）
#[tauri::command]
pub async fn cancel_processing() -> Result<(), String> {
    todo!("cancel_processing will be implemented in Stage 2+")
}
