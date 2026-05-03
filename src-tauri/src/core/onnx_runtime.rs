//! ONNX Runtime 动态加载模块
//!
//! 根据当前 CPU 的指令集支持情况，自动选择合适版本的 ONNX Runtime 共享库：
//! - 支持 AVX → 高性能版（利用 AVX/AVX2 指令集）
//! - 不支持 AVX → 兼容版（仅需 SSE4.2）
//!
//! 使用 `ort` 的 `load-dynamic` feature，运行时动态加载共享库，
//! 避免在不支持 AVX 的 CPU 上出现 `STATUS_ILLEGAL_INSTRUCTION` 崩溃。
//!
//! 平台差异：
//! - Windows: `onnxruntime_avx.dll` / `onnxruntime_noavx.dll`
//! - macOS:   `libonnxruntime.dylib`（macOS 不区分 AVX，所有 Intel Mac 均支持 AVX）
//! - Linux:   `libonnxruntime.so`（Linux 同理，x86_64 通常支持 AVX）

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};

/// 全局标记：ONNX Runtime 是否初始化成功
static ORT_INITIALIZED: AtomicBool = AtomicBool::new(false);

/// 检测 CPU 是否支持 AVX 指令集
fn cpu_supports_avx() -> bool {
    #[cfg(target_arch = "x86_64")]
    {
        std::arch::is_x86_feature_detected!("avx")
    }

    #[cfg(not(target_arch = "x86_64"))]
    {
        true
    }
}

/// 返回平台对应的共享库文件名
///
/// Windows 需要区分 AVX/no-AVX（E5 等 CPU 不支持 AVX），
/// macOS/Linux 的 x86_64 硬件普遍支持 AVX，无需区分。
fn get_library_filenames() -> (&'static str, &'static str, &'static str) {
    // (avx_specific, noavx_specific, generic)
    if cfg!(target_os = "windows") {
        if cpu_supports_avx() {
            ("onnxruntime_avx.dll", "onnxruntime_noavx.dll", "onnxruntime.dll")
        } else {
            ("onnxruntime_noavx.dll", "onnxruntime_avx.dll", "onnxruntime.dll")
        }
    } else if cfg!(target_os = "macos") {
        // macOS 不区分 AVX，Intel Mac 均有 AVX，Apple Silicon 不涉及 x86
        ("libonnxruntime.dylib", "libonnxruntime.dylib", "libonnxruntime.dylib")
    } else {
        // Linux 等
        ("libonnxruntime.so", "libonnxruntime.so", "libonnxruntime.so")
    }
}

/// 根据目录和 CPU 能力，解析应加载的共享库路径
fn resolve_library_path(base_dir: &std::path::Path) -> Option<PathBuf> {
    let (preferred, _fallback, generic) = get_library_filenames();

    // 1. 优先加载平台/AVX 匹配的版本
    let preferred_path = base_dir.join(preferred);
    if preferred_path.exists() {
        log::info!("已找到 ONNX Runtime: {}", preferred_path.display());
        return Some(preferred_path);
    }

    // 2. 回退到通用文件名
    let generic_path = base_dir.join(generic);
    if generic_path.exists() {
        log::info!("已找到通用 ONNX Runtime: {}", generic_path.display());
        return Some(generic_path);
    }

    None
}

/// 在多个候选目录中查找 ONNX Runtime 共享库
fn find_onnxruntime_library(resource_dir: Option<&std::path::Path>) -> Option<PathBuf> {
    // 1. Tauri resource 目录（生产环境：安装目录下的 resources/）
    if let Some(res_dir) = resource_dir {
        let onnx_dir = res_dir.join("resources").join("onnx");
        if let Some(path) = resolve_library_path(&onnx_dir) {
            return Some(path);
        }
        if let Some(path) = resolve_library_path(res_dir) {
            return Some(path);
        }
    }

    // 2. 可执行文件所在目录（便携部署 / macOS .app bundle 内）
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            if let Some(path) = resolve_library_path(exe_dir) {
                return Some(path);
            }
        }
    }

    // 3. 当前工作目录（开发模式）
    if let Ok(cwd) = std::env::current_dir() {
        if let Some(path) = resolve_library_path(&cwd) {
            return Some(path);
        }
    }

    None
}

/// 初始化 ONNX Runtime
///
/// 必须在所有 `ort` API 使用之前调用。
/// `resource_dir`：Tauri 应用的 resource 目录路径，用于定位共享库文件。
/// 成功返回 true，失败返回 false（鸟类检测/分类功能将不可用，但不影响主流水线）。
pub fn init_onnx_runtime(resource_dir: Option<&std::path::Path>) -> bool {
    if ORT_INITIALIZED.load(Ordering::Acquire) {
        return true;
    }

    match find_onnxruntime_library(resource_dir) {
        Some(lib_path) => {
            match ort::init_from(lib_path) {
                Ok(builder) => {
                    builder.commit();
                    log::info!("ONNX Runtime 初始化成功");
                    ORT_INITIALIZED.store(true, Ordering::Release);
                    true
                }
                Err(e) => {
                    log::error!("ONNX Runtime 初始化失败: {}", e);
                    log::error!("鸟类检测和分类功能将不可用，但不影响图片分组和筛选");
                    false
                }
            }
        }
        None => {
            log::warn!("未找到 ONNX Runtime 共享库，鸟类检测和分类功能将不可用");
            false
        }
    }
}

/// 检查 ONNX Runtime 是否已成功初始化
pub fn is_available() -> bool {
    ORT_INITIALIZED.load(Ordering::Acquire)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cpu_supports_avx_returns_bool() {
        let _ = cpu_supports_avx();
    }

    #[test]
    fn test_library_filenames_returns_valid_names() {
        let (preferred, _fallback, generic) = get_library_filenames();
        assert!(!preferred.is_empty());
        assert!(!generic.is_empty());
    }
}
