// ============================================================
// 导出命令
//
// - select_export_dir: 打开文件夹选择对话框
// - export_images: 批量复制 RAW 文件到目标目录
//   支持冲突重命名、进度推送、错误收集
// ============================================================

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{Emitter, Window};

use crate::state::SessionState;

// ─── 返回类型 ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub exported_count: usize,
    pub total_count: usize,
    pub target_dir: String,
    pub failed_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExportProgress {
    pub current: usize,
    pub total: usize,
}

// ─── select_export_dir ────────────────────────────────

#[tauri::command]
pub async fn select_export_dir(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let dir = app
        .dialog()
        .file()
        .set_title("选择导出目录")
        .blocking_pick_folder();

    Ok(dir.map(|p| p.to_string()))
}

// ─── export_images ────────────────────────────────────

#[tauri::command]
pub async fn export_images(
    hashes: Vec<String>,
    target_dir: String,
    window: Window,
    state: tauri::State<'_, Arc<Mutex<SessionState>>>,
) -> Result<ExportResult, String> {
    let total = hashes.len();

    // 从 SessionState 获取 hash → 路径映射
    let hash_path_map: HashMap<String, PathBuf> = {
        let session = state
            .lock()
            .map_err(|e| format!("无法获取会话状态锁: {}", e))?;
        hashes
            .iter()
            .filter_map(|h| session.hash_path_map.get(h).map(|p| (h.clone(), p.clone())))
            .collect()
    };

    // 确保目标目录存在
    let target = PathBuf::from(&target_dir);
    tokio::fs::create_dir_all(&target)
        .await
        .map_err(|e| format!("无法创建目标目录: {}", e))?;

    let mut exported_count = 0usize;
    let mut failed_files: Vec<String> = Vec::new();

    for (idx, hash) in hashes.iter().enumerate() {
        let src_path = match hash_path_map.get(hash) {
            Some(p) => p,
            None => {
                failed_files.push(format!("hash {} 未找到源文件", hash));
                // 发送进度
                let _ = window.emit(
                    "export-progress",
                    ExportProgress {
                        current: idx + 1,
                        total,
                    },
                );
                continue;
            }
        };

        // 获取源文件名
        let file_name = src_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| {
                let ext = src_path
                    .extension()
                    .map(|e| format!(".{}", e.to_string_lossy()))
                    .unwrap_or_default();
                format!("{}{}", hash, ext)
            });

        // 处理文件名冲突
        let dest_path = resolve_conflict(&target, &file_name).await;

        // 复制文件
        match tokio::fs::copy(src_path, &dest_path).await {
            Ok(_) => {
                exported_count += 1;
            }
            Err(e) => {
                failed_files.push(format!("{}: {}", file_name, e));
            }
        }

        // 发送进度
        let _ = window.emit(
            "export-progress",
            ExportProgress {
                current: idx + 1,
                total,
            },
        );
    }

    Ok(ExportResult {
        exported_count,
        total_count: total,
        target_dir,
        failed_files,
    })
}

// ─── 辅助函数 ─────────────────────────────────────────

/// 解决文件名冲突：已存在时追加 _1, _2, ... 后缀
async fn resolve_conflict(dir: &Path, file_name: &str) -> PathBuf {
    let candidate = dir.join(file_name);
    if !candidate.exists() {
        return candidate;
    }

    let stem = Path::new(file_name)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| file_name.to_string());
    let ext = Path::new(file_name)
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();

    let mut counter = 1u32;
    loop {
        let new_name = format!("{}_{}{}", stem, counter, ext);
        let new_path = dir.join(&new_name);
        if !new_path.exists() {
            return new_path;
        }
        counter += 1;
    }
}

// ─── 测试 ─────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_resolve_conflict_no_conflict() {
        let dir = tempfile::tempdir().unwrap();
        let result = resolve_conflict(dir.path(), "IMG_001.nef").await;
        assert_eq!(result, dir.path().join("IMG_001.nef"));
    }

    #[tokio::test]
    async fn test_resolve_conflict_single() {
        let dir = tempfile::tempdir().unwrap();
        // 创建已存在的文件
        std::fs::write(dir.path().join("IMG_001.nef"), b"").unwrap();
        let result = resolve_conflict(dir.path(), "IMG_001.nef").await;
        assert_eq!(result, dir.path().join("IMG_001_1.nef"));
    }

    #[tokio::test]
    async fn test_resolve_conflict_multiple() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("IMG_001.nef"), b"").unwrap();
        std::fs::write(dir.path().join("IMG_001_1.nef"), b"").unwrap();
        let result = resolve_conflict(dir.path(), "IMG_001.nef").await;
        assert_eq!(result, dir.path().join("IMG_001_2.nef"));
    }

    #[tokio::test]
    async fn test_resolve_conflict_no_extension() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("README"), b"").unwrap();
        let result = resolve_conflict(dir.path(), "README").await;
        assert_eq!(result, dir.path().join("README_1"));
    }

    #[test]
    fn test_export_result_serialization() {
        let result = ExportResult {
            exported_count: 5,
            total_count: 7,
            target_dir: "/exports".into(),
            failed_files: vec!["bad.nef: not found".into()],
        };
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json["exportedCount"], 5);
        assert_eq!(json["totalCount"], 7);
        assert_eq!(json["targetDir"], "/exports");
        assert_eq!(json["failedFiles"][0], "bad.nef: not found");
    }
}
