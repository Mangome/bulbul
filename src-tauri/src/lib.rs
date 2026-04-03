mod commands;
mod core;
mod models;
mod state;
mod utils;

use std::sync::{Arc, Mutex};

use tauri::{image::Image, Manager};

use state::SessionState;
use utils::paths::get_cache_base_dir;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志系统
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Debug)
        .format_timestamp_millis()
        .init();
    
    log::info!("Bulbul 应用启动");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let cache_dir = app
                .path()
                .cache_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from(".cache"));
            log::info!("系统缓存目录: {}", cache_dir.display());
            
            let cache_base = get_cache_base_dir(&cache_dir);
            log::info!("应用缓存基目录: {}", cache_base.display());
            
            // 确保缓存目录存在
            if let Err(e) = std::fs::create_dir_all(&cache_base) {
                log::warn!("创建缓存目录失败: {}", e);
            } else {
                log::info!("缓存目录已确保存在");
            }
            
            let session = SessionState::with_cache_dir(cache_base);
            app.manage(Arc::new(Mutex::new(session)));

            // 为所有窗口设置图标（dev 模式下 bundle.icon 不会嵌入 exe）
            let icon_bytes = include_bytes!("../icons/icon.png");
            if let Ok(icon) = Image::from_bytes(icon_bytes) {
                for (_label, window) in app.webview_windows() {
                    let _ = window.set_icon(icon.clone());
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::file_commands::select_folder,
            commands::file_commands::get_folder_info,
            commands::file_commands::scan_raw_files,
            commands::file_commands::get_current_folder,
            commands::window_commands::open_main_window,
            commands::process_commands::process_folder,
            commands::process_commands::cancel_processing,
            commands::image_commands::get_image_url,
            commands::image_commands::get_metadata,
            commands::image_commands::get_batch_metadata,
            commands::export_commands::select_export_dir,
            commands::export_commands::export_images,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
