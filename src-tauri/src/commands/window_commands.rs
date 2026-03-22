use tauri::{AppHandle, Manager};
use tauri::webview::WebviewWindowBuilder;

/// 动态创建 Main 窗口（1200×900）并关闭 Welcome 窗口
#[tauri::command]
pub async fn open_main_window(app: AppHandle, folder_path: String) -> Result<(), String> {
    // 检查 Main 窗口是否已存在
    if let Some(existing) = app.get_webview_window("main") {
        // 已存在则聚焦
        existing.set_focus().map_err(|e| e.to_string())?;
    } else {
        // 创建新的 Main 窗口
        let _main_window = WebviewWindowBuilder::new(
            &app,
            "main",
            tauri::WebviewUrl::App("index.html".into()),
        )
        .title("Bulbul")
        .inner_size(1200.0, 900.0)
        .center()
        .build()
        .map_err(|e| e.to_string())?;
    }

    // 关闭 Welcome 窗口
    if let Some(welcome) = app.get_webview_window("welcome") {
        welcome.close().map_err(|e| e.to_string())?;
    }

    Ok(())
}
