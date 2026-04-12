/// 为窗口同时设置 ICON_SMALL 和 ICON_BIG。
///
/// Tauri 的 `window.set_icon()` 底层只设置了 `ICON_SMALL`（标题栏图标），
/// 任务栏使用 `ICON_BIG`，若未设置则回退到 EXE 内嵌资源的小帧，导致模糊/偏小。
#[cfg(target_os = "windows")]
pub fn set_window_icons(window: &tauri::WebviewWindow) {
    let icon_bytes = include_bytes!("../../icons/icon.png");
    if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
        // Tauri set_icon → WM_SETICON(ICON_SMALL)
        let _ = window.set_icon(icon.clone());
        // 额外设置 ICON_BIG → 任务栏 + Alt+Tab 使用
        if let Ok(hwnd) = window.hwnd() {
            crate::utils::windows_icon::set_big_icon(hwnd, &icon);
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn set_window_icons(window: &tauri::WebviewWindow) {
    let icon_bytes = include_bytes!("../../icons/icon.png");
    if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
        let _ = window.set_icon(icon);
    }
}
