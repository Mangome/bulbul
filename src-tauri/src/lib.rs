mod commands;
mod core;
mod models;
mod state;
mod utils;

use std::sync::{Arc, Mutex};

use state::SessionState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Arc::new(Mutex::new(SessionState::new())))
        .invoke_handler(tauri::generate_handler![
            commands::file_commands::select_folder,
            commands::file_commands::get_folder_info,
            commands::file_commands::scan_raw_files,
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
