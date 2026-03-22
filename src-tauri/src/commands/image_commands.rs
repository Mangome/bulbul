/// 获取图片 URL（空壳，Stage 2+ 实现）
#[tauri::command]
pub async fn get_image_url(
    _hash: String,
    _size: Option<String>,
) -> Result<String, String> {
    todo!("get_image_url will be implemented in Stage 2+")
}

/// 获取单张图片元数据（空壳，Stage 2+ 实现）
#[tauri::command]
pub async fn get_metadata(_hash: String) -> Result<String, String> {
    todo!("get_metadata will be implemented in Stage 2+")
}

/// 批量获取元数据（空壳，Stage 2+ 实现）
#[tauri::command]
pub async fn get_batch_metadata(_hashes: Vec<String>) -> Result<Vec<String>, String> {
    todo!("get_batch_metadata will be implemented in Stage 2+")
}
