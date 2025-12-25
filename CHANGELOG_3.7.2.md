<div align="center">
  <img src="https://gw.alipayobjects.com/zos/k/fa/logo-modified.png" alt="Pake Logo" width="120" height="120" style="border-radius:50%" />
  <h1 style="margin: 12px 0 6px;">Pake V3.7.2</h1>
  <p><em>Turn any webpage into a desktop app with one command.</em></p>
</div>

### Changelog
1. **Performance Optimizations**: Introduced Rust release profile optimizations with LTO and size reduction, resulting in significantly smaller binaries and faster app performance across all platforms.
2. **Intelligent Media Handling**: Fixed critical issue where images and videos from CDNs were incorrectly treated as downloads. Added smart detection for 25+ media formats (PNG, JPG, MP4, WebM, etc.) to preview in-app instead of downloading.
3. **Local Icon Support**: Apps now check for existing local icons before downloading, reducing build times and network dependencies. Migrated from axios to native fetch API for better timeout handling.
4. **Enhanced Error Handling**: Replaced unsafe Rust code with proper error propagation throughout the codebase. Menu system refactored with better error messages and macOS-specific optimizations.
5. **Linux Packaging Improvements**: Enhanced Linux packaging with consistent binary naming across DEB, RPM, and AppImage formats, plus improved desktop file generation with full RPM support.
6. **Testing Infrastructure**: Added 600+ lines of comprehensive unit and integration tests covering builders, file operations, and CI/CD workflows for better code quality and release reliability.
7. **Dependency Updates**: Upgraded Tauri to v2.9.5, updated all major dependencies including file-type, sharp, and build tools. Completely removed axios dependency in favor of native APIs.

### 更新日志
1. **性能优化**：引入 Rust 编译优化配置，包含 LTO 链接时优化和体积压缩，所有平台的应用体积显著减小，运行性能大幅提升。
2. **智能媒体处理**：修复 CDN 图片和视频被错误识别为下载文件的关键问题。新增 25+ 种媒体格式（PNG、JPG、MP4、WebM 等）的智能识别，支持应用内直接预览而非下载。
3. **本地图标支持**：构建时优先使用已存在的本地图标，减少网络请求和构建时间。将 axios 迁移至原生 fetch API，提供更好的超时控制。
4. **错误处理增强**：在整个代码库中将不安全的 Rust 代码替换为正确的错误传播机制。菜单系统重构，提供更清晰的错误信息和 macOS 专属优化。
5. **Linux 打包改进**：优化 Linux 打包流程，DEB、RPM 和 AppImage 格式的二进制命名保持一致，改进桌面文件生成逻辑并完整支持 RPM。
6. **测试基础设施**：新增 600+ 行全面的单元测试和集成测试，覆盖构建器、文件操作和 CI/CD 工作流，提升代码质量和发布可靠性。
7. **依赖更新**：升级 Tauri 至 v2.9.5，更新所有主要依赖包括 file-type、sharp 和构建工具。完全移除 axios 依赖，改用原生 API。

---

Learn how to use it through this main document. If you think Pake is useful to you, welcome to Star
> <https://github.com/tw93/Pake>
