/// 选择导出目录（空壳，Stage 5 实现）
#[tauri::command]
pub async fn select_export_dir() -> Result<Option<String>, String> {
    todo!("select_export_dir will be implemented in Stage 5")
}

/// 导出图片（空壳，Stage 5 实现）
#[tauri::command]
pub async fn export_images(
    _hashes: Vec<String>,
    _target_dir: String,
) -> Result<(), String> {
    todo!("export_images will be implemented in Stage 5")
}
