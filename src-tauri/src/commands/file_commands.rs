use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri_plugin_dialog::DialogExt;

use crate::models::AppError;

/// 文件夹信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderInfo {
    pub path: String,
    pub name: String,
    pub file_count: usize,
    pub raw_count: usize,
}

/// 扫描结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub files: Vec<String>,
    pub count: usize,
}

/// 弹出系统文件夹选择对话框
#[tauri::command]
pub async fn select_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let folder = app
        .dialog()
        .file()
        .blocking_pick_folder();

    match folder {
        Some(path) => Ok(Some(path.to_string())),
        None => Ok(None),
    }
}

/// 获取文件夹信息（文件总数、RAW 文件数量）
#[tauri::command]
pub async fn get_folder_info(path: String) -> Result<FolderInfo, String> {
    let dir_path = Path::new(&path);

    if !dir_path.exists() {
        return Err(AppError::FileNotFound(path).to_string());
    }

    let mut file_count = 0usize;
    let mut raw_count = 0usize;

    let entries = std::fs::read_dir(dir_path)
        .map_err(|e| AppError::IoError(e).to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| AppError::IoError(e).to_string())?;
        let path = entry.path();
        if path.is_file() {
            file_count += 1;
            if let Some(ext) = path.extension() {
                if ext.to_string_lossy().to_lowercase() == "nef" {
                    raw_count += 1;
                }
            }
        }
    }

    let name = dir_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    Ok(FolderInfo {
        path: path.clone(),
        name,
        file_count,
        raw_count,
    })
}

/// 扫描文件夹中的所有 .nef 文件（非递归，大小写不敏感）
#[tauri::command]
pub async fn scan_raw_files(path: String) -> Result<ScanResult, String> {
    let dir_path = Path::new(&path);

    if !dir_path.exists() {
        return Err(AppError::FileNotFound(path).to_string());
    }

    let entries = std::fs::read_dir(dir_path)
        .map_err(|e| AppError::IoError(e).to_string())?;

    let mut files = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| AppError::IoError(e).to_string())?;
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext.to_string_lossy().to_lowercase() == "nef" {
                    files.push(path.to_string_lossy().to_string());
                }
            }
        }
    }

    let count = files.len();
    Ok(ScanResult { files, count })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use std::io::Write;
    use tempfile::tempdir;

    // 注意：select_folder 需要 Tauri AppHandle，无法在纯单元测试中测试。
    // get_folder_info 和 scan_raw_files 可以使用临时目录测试。

    // 由于 get_folder_info 和 scan_raw_files 是 async 函数，
    // 我们使用 tokio::test 来测试

    #[tokio::test]
    async fn test_get_folder_info_with_nef_files() {
        let dir = tempdir().unwrap();
        let dir_path = dir.path();

        // 创建测试文件
        File::create(dir_path.join("img1.nef")).unwrap().write_all(b"nef1").unwrap();
        File::create(dir_path.join("img2.NEF")).unwrap().write_all(b"nef2").unwrap();
        File::create(dir_path.join("img3.jpg")).unwrap().write_all(b"jpg1").unwrap();
        File::create(dir_path.join("img4.nef")).unwrap().write_all(b"nef3").unwrap();
        File::create(dir_path.join("img5.txt")).unwrap().write_all(b"txt1").unwrap();

        let info = get_folder_info(dir_path.to_string_lossy().to_string()).await.unwrap();
        assert_eq!(info.file_count, 5);
        assert_eq!(info.raw_count, 3); // img1.nef, img2.NEF, img4.nef
    }

    #[tokio::test]
    async fn test_get_folder_info_nonexistent_path() {
        let result = get_folder_info("/nonexistent/path/that/does/not/exist".to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_scan_raw_files() {
        let dir = tempdir().unwrap();
        let dir_path = dir.path();

        File::create(dir_path.join("photo1.nef")).unwrap().write_all(b"nef").unwrap();
        File::create(dir_path.join("photo2.NEF")).unwrap().write_all(b"nef").unwrap();
        File::create(dir_path.join("photo3.jpg")).unwrap().write_all(b"jpg").unwrap();

        let result = scan_raw_files(dir_path.to_string_lossy().to_string()).await.unwrap();
        assert_eq!(result.count, 2);
        assert_eq!(result.files.len(), 2);
    }

    #[tokio::test]
    async fn test_scan_raw_files_empty_folder() {
        let dir = tempdir().unwrap();
        let result = scan_raw_files(dir.path().to_string_lossy().to_string()).await.unwrap();
        assert_eq!(result.count, 0);
        assert!(result.files.is_empty());
    }
}
