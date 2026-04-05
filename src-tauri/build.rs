use std::path::PathBuf;

fn main() {
    // 配置资源打包：将 src-tauri/resources 目录内容复制到分发包
    // Tauri 会自动将 resources/ 中的文件打包到安装包中
    let resources_dir = PathBuf::from("resources");
    if resources_dir.exists() {
        println!("cargo:rerun-if-changed=resources");
        // 指定监听 resources 目录的变化，触发重新编译
        println!("cargo:rerun-if-changed=resources/models");
    }
    
    tauri_build::build()
}
