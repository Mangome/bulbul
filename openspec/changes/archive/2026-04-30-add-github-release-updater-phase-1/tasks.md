## 1. 桌面端 updater 配置

- [x] 1.1 为前端和 Rust 端添加 updater / process 相关依赖
- [x] 1.2 在 `src-tauri/src/lib.rs` 注册 updater 与 process 插件
- [x] 1.3 在 `src-tauri/capabilities/default.json` 增加 updater 和 process 权限
- [x] 1.4 在 `src-tauri/tauri.conf.json` 配置 updater endpoint、公钥和 `createUpdaterArtifacts`

## 2. 发布流程改造

- [x] 2.1 更新 `.github/workflows/release.yml` 以生成并上传 updater 所需产物
- [x] 2.2 将 updater 私钥相关环境变量接入 GitHub Actions 发布流程
- [x] 2.3 校验 release 产物中包含平台安装包、对应 `.sig` 文件和 `latest.json`

## 3. 应用内更新能力

- [x] 3.1 新增前端更新服务，封装检查更新、下载安装和重启逻辑
- [x] 3.2 在设置面板新增版本更新区域并展示当前版本
- [x] 3.3 实现检查中、可更新、下载中、安装中、失败和最新版本等状态反馈
- [x] 3.4 防止更新进行中重复触发检查或安装操作

## 4. 验证与发布验收

- [x] 4.1 为更新服务或设置面板补充必要的单元测试
- [x] 4.2 本地验证配置改动不会破坏现有前端构建与 Tauri 构建
- [ ] 4.3 使用测试版本执行一次从 GitHub Release 到应用内安装更新的端到端验收