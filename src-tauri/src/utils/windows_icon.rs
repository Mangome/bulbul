use tauri::image::Image;
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{CreateIcon, DestroyIcon, SendMessageW, ICON_BIG, WM_SETICON};

/// 将 RGBA 像素数据创建为 HICON，并通过 WM_SETICON(ICON_BIG) 设置到窗口。
///
/// 实现方式与 tao 的 `WinIcon::from_rgba` + `set_for_window(IconType::Big)` 一致：
/// RGBA → BGRA + AND mask → CreateIcon → SendMessageW。
pub fn set_big_icon(hwnd: HWND, image: &Image<'_>) {
    let rgba = image.rgba();
    let width = image.width();
    let height = image.height();
    let pixel_count = rgba.len() / 4;

    let mut bgra = rgba.to_vec();
    let mut and_mask = Vec::with_capacity(pixel_count);

    // RGBA → BGRA，同时构建 AND mask（alpha 反转）
    let pixels = unsafe { std::slice::from_raw_parts_mut(bgra.as_mut_ptr() as *mut [u8; 4], pixel_count) };
    for pixel in pixels {
        and_mask.push(pixel[3].wrapping_sub(u8::MAX)); // invert alpha
        pixel.swap(0, 2); // R ↔ B
    }

    let handle = unsafe {
        CreateIcon(
            None,
            width as i32,
            height as i32,
            1,
            32,
            and_mask.as_ptr(),
            bgra.as_ptr(),
        )
    };

    if let Ok(hicon) = handle {
        unsafe {
            let _ = SendMessageW(
                hwnd,
                WM_SETICON,
                Some(windows::Win32::Foundation::WPARAM(ICON_BIG as usize)),
                Some(windows::Win32::Foundation::LPARAM(hicon.0 as isize)),
            );
        }
        // SendMessageW 复制图标句柄，原始句柄可安全销毁
        let _ = unsafe { DestroyIcon(hicon) };
    }
}
