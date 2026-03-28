use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Manager};
use tauri::webview::WebviewWindowBuilder;

use crate::state::SessionState;

/// 动态创建 Main 窗口（1200×900）并关闭 Welcome 窗口
///
/// 同时将选定的文件夹路径保存到 SessionState，供 MainPage 读取。
#[tauri::command]
pub async fn open_main_window(
    app: AppHandle,
    state: tauri::State<'_, Arc<Mutex<SessionState>>>,
    folder_path: String,
) -> Result<(), String> {
    // 保存文件夹路径到 SessionState
    {
        let mut s = state.lock().map_err(|e| e.to_string())?;
        s.current_folder = Some(std::path::PathBuf::from(&folder_path));
    }

    // 检查 Main 窗口是否已存在
    if let Some(existing) = app.get_webview_window("main") {
        // 已存在则聚焦
        existing.set_focus().map_err(|e| e.to_string())?;
    } else {
        // 创建新的 Main 窗口
        let main_window = WebviewWindowBuilder::new(
            &app,
            "main",
            tauri::WebviewUrl::App("index.html".into()),
        )
        .title("Bulbul")
        .inner_size(1200.0, 900.0)
        .center()
        .build()
        .map_err(|e| e.to_string())?;

        // 默认最大化
        main_window.maximize().map_err(|e| e.to_string())?;
    }

    // 关闭 Welcome 窗口
    if let Some(welcome) = app.get_webview_window("welcome") {
        welcome.close().map_err(|e| e.to_string())?;
    }

    Ok(())
}
