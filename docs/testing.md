# Pake CLI 测试

统一的 CLI 构建测试套件，用于验证多平台打包功能。

## 运行测试

```bash
# 完整测试套件（推荐）
pnpm test                   # 运行完整测试套件，包含真实构建测试（8-12分钟）

# 开发时快速测试
pnpm test -- --no-build     # 跳过构建测试，仅验证核心功能（30秒）
```

### 🚀 完整测试套件包含

- ✅ **单元测试**：CLI命令、参数验证、响应时间
- ✅ **集成测试**：进程管理、文件权限、依赖解析
- ✅ **构建器测试**：平台检测、架构检测、文件命名
- ✅ **真实构建测试**：完整的GitHub.com应用打包验证

## 测试内容

### 单元测试（6个）

- 版本命令 (`--version`)
- 帮助命令 (`--help`)
- URL 验证（有效/无效链接）
- 参数验证（数字类型检查）
- CLI 响应时间（<2秒）
- Weekly URL 可访问性

### 集成测试（3个）

- 进程生成和管理
- 文件系统权限检查
- 依赖包解析验证

### 构建测试（3个）

- 平台检测（macOS/Windows/Linux）
- 架构检测（Intel/ARM64）
- 文件命名模式验证

### 真实构建测试（重点）

**macOS**: 🔥 多架构构建（通用二进制）

- 编译 Intel + Apple Silicon 双架构
- 检测 `.app` 文件生成：`GitHubMultiArch.app`
- 备用检测：`src-tauri/target/universal-apple-darwin/release/bundle/macos/`
- 验证通用二进制：`file` 命令检查架构

**Windows**: 单架构构建

- 检测 EXE 文件：`src-tauri/target/x86_64-pc-windows-msvc/release/pake.exe`
- 检测 MSI 安装包：`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/*.msi`

**Linux**: 单架构构建

- 检测 DEB 包：`src-tauri/target/release/bundle/deb/*.deb`
- 检测 AppImage：`src-tauri/target/release/bundle/appimage/*.AppImage`

## 为什么重点测试多架构？

多架构构建是最复杂、最容易出错的环节：

- 需要同时编译两个架构（x86_64 + aarch64）
- 生成通用二进制文件技术复杂
- 架构兼容性问题频发
- Apple Silicon 迁移期关键功能

## 测试结果

总计：**13 个测试**，全部通过表示 CLI 功能正常。

## 故障排除

**CLI 文件不存在**：运行 `pnpm run cli:build`

**测试超时**：构建测试需要较长时间完成

**构建失败**：检查 Rust 工具链 `rustup update`

**权限错误**：确保有写入权限

## 发布构建测试

```bash
# 实际构建测试（固定测试 weread + twitter 两个应用）
node ./tests/release.js
```

真实构建2个应用包，验证完整的打包流程和 release.yml 逻辑是否正常工作。

## 开发建议

提交代码前建议运行 `pnpm test` 确保所有平台构建正常。
