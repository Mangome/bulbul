mod commands;
mod core;
mod models;
mod state;
mod utils;

use std::sync::{Arc, Mutex};

use tauri::Manager;

use state::SessionState;
use utils::icon::set_window_icons;
use utils::paths::get_cache_base_dir;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志系统
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Debug)
        .format_timestamp_millis()
        .init();

    log::info!("Bulbul 应用启动");
    let app_start = std::time::Instant::now();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .on_page_load(move |webview, payload| {
            // 页面加载完成时显示窗口，不依赖前端 JS 执行
            if payload.event() == tauri::webview::PageLoadEvent::Finished {
                let label = webview.label().to_string();
                let window = webview.window();
                let _ = window.show();
                log::info!(
                    "[启动计时] 窗口已显示: label={}, url={}, elapsed={:?}",
                    label,
                    payload.url(),
                    app_start.elapsed(),
                );
            }
        })
        .setup(move |app| {
            log::info!("[启动计时] setup() 开始: {:?}", app_start.elapsed());

            app.handle().plugin(tauri_plugin_process::init())?;
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

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
            log::info!("[启动计时] setup() 缓存目录完成: {:?}", app_start.elapsed());

            let session = SessionState::with_cache_dir(cache_base);
            app.manage(Arc::new(Mutex::new(session)));

            // 为所有窗口设置图标（同时设置 ICON_SMALL + ICON_BIG）
            for (_label, window) in app.webview_windows() {
                set_window_icons(&window);
            }
            log::info!("[启动计时] setup() 完成: {:?}", app_start.elapsed());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::file_commands::select_folder,
            commands::file_commands::get_folder_info,
            commands::file_commands::scan_image_files,
            commands::file_commands::get_current_folder,
            commands::window_commands::open_main_window,
            commands::process_commands::process_folder,
            commands::process_commands::cancel_processing,
            commands::process_commands::regroup,
            commands::process_commands::reclassify,
            commands::image_commands::get_image_url,
            commands::image_commands::get_metadata,
            commands::image_commands::get_batch_metadata,
            commands::export_commands::select_export_dir,
            commands::export_commands::export_images,
            commands::cache_commands::get_cache_size,
            commands::cache_commands::clear_cache,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
