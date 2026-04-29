use std::sync::{Arc, Mutex};

use tauri::webview::WebviewWindowBuilder;
use tauri::{AppHandle, Manager};

use crate::state::SessionState;
use crate::utils::icon::set_window_icons;

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
        // 创建新的 Main 窗口（初始不可见，由 Rust on_page_load 回调显示）
        let main_window =
            WebviewWindowBuilder::new(&app, "main", tauri::WebviewUrl::App("index.html".into()))
                .title("Bulbul")
                .inner_size(1200.0, 900.0)
                .center()
                .visible(false)
                .build()
                .map_err(|e| e.to_string())?;

        // 设置窗口图标（ICON_SMALL + ICON_BIG）
        set_window_icons(&main_window);

        // 默认最大化
        main_window.maximize().map_err(|e| e.to_string())?;
    }

    // 关闭 Welcome 窗口
    if let Some(welcome) = app.get_webview_window("welcome") {
        welcome.close().map_err(|e| e.to_string())?;
    }

    Ok(())
}
