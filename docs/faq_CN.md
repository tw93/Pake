# 常见问题 (FAQ)

<h4 align="right"><a href="faq.md">English</a> | <strong>简体中文</strong></h4>

使用 Pake 时的常见问题和解决方案。

## 目录

- [构建问题](#构建问题)
  - [Rust 版本错误:"feature 'edition2024' is required"](#rust-版本错误feature-edition2024-is-required)
  - [Linux：Ubuntu 24.04 构建报错 "Can't detect any appindicator library"](#linuxubuntu-2404-构建报错-cant-detect-any-appindicator-library)
  - [Linux：在 Fedora / RHEL / Oracle Linux 等 RPM 系发行版上安装](#linux在-fedora--rhel--oracle-linux-等-rpm-系发行版上安装)
  - [Linux：AppImage 构建失败，提示 "failed to run linuxdeploy"](#linuxappimage-构建失败提示-failed-to-run-linuxdeploy)
  - [Linux：AppImage 启动即崩溃，提示找不到 WebKitNetworkProcess](#linuxappimage-启动即崩溃提示找不到-webkitnetworkprocess)
  - [Linux:"cargo: command not found" 即使已安装 Rust](#linuxcargo-command-not-found-即使已安装-rust)
  - [Windows：首次构建时安装超时](#windows首次构建时安装超时)
  - [Windows：缺少 Visual Studio 构建工具](#windows缺少-visual-studio-构建工具)
  - [macOS：构建失败，出现模块编译错误](#macos构建失败出现模块编译错误)
- [运行时问题](#运行时问题)
  - [应用窗口太小/太大](#应用窗口太小太大)
  - [应用图标显示不正确](#应用图标显示不正确)
  - [网站功能不工作（登录、上传等）](#网站功能不工作登录上传等)
  - [应用占用内存比预期高](#应用占用内存比预期高)
- [安装问题](#安装问题)
  - [全局安装时权限被拒绝](#全局安装时权限被拒绝)
- [获取帮助](#获取帮助)

---

## 构建问题

### Rust 版本错误:"feature 'edition2024' is required"

**问题描述：**
在构建 Pake 或使用 CLI 时，遇到如下错误：

```txt
error: failed to parse manifest
Caused by:
  feature `edition2024` is required
  this Cargo does not support nightly features, but if you switch to nightly channel you can add `cargo-features = ["edition2024"]`
  to enable this feature
```

**原因分析：**

Pake 的依赖项需要 Rust edition2024 支持，该特性仅在 Rust 1.85.0 或更高版本中可用。具体来说：

- 依赖链包括：`tauri` → `image` → `moxcms` → `pxfm v0.1.25`（需要 edition2024）
- Rust edition2024 在 Rust 1.85.0（2025 年 2 月发布）中成为稳定版
- 如果您的 Rust 版本较旧（例如 2024 年 8 月的 1.82.0），就会看到此错误

**解决方案：**

将 Rust 工具链更新到 1.85.0 或更高版本：

```bash
# 更新到最新稳定版 Rust
rustup update stable

# 或者安装最新稳定版
rustup install stable

# 验证更新
rustc --version
# 应显示：rustc 1.85.0 或更高版本
```

更新后，重新执行构建命令。

**对于开发环境设置：**

如果您正在设置开发环境，请确保：

- Rust ≥1.85.0（使用 `rustc --version` 检查）
- Node.js ≥22.0.0（使用 `node --version` 检查）

详见 [CONTRIBUTING.md](../CONTRIBUTING.md) 获取完整的前置条件。

---

### Linux：Ubuntu 24.04 构建报错 "Can't detect any appindicator library"

**问题描述：**
在 Ubuntu 24.04 或更新版本上构建时，可能遇到以下错误：

```txt
Can't detect any appindicator library
```

或者在之前的版本中可能看到关于 Icon RGBA 的报错。

**解决方案：**

这是因为 Ubuntu 24.04+ 使用 `libayatana-appindicator3-dev` 替代了旧的 `libappindicator3-dev`。

请安装正确的依赖库：

```bash
sudo apt-get update
sudo apt-get install -y libayatana-appindicator3-dev
```

---

### Linux：在 Fedora / RHEL / Oracle Linux 等 RPM 系发行版上安装

**问题：**
在 RPM 系发行版（Fedora、RHEL、Oracle Linux、Rocky、AlmaLinux、openSUSE）上，
`.deb` 包无法被系统包管理器安装，而旧版本 Pake 总是先构建 `.deb`。

**解决方法：**

Pake 现在会读取 `/etc/os-release` 来决定默认打包目标：RPM 系发行版默认使用
`rpm, appimage`，Debian/Ubuntu 仍然是 `deb, appimage`。所以基础命令就能直接产出
可安装的包：

```bash
pake https://github.com --name GitHub
sudo dnf install ./GitHub.rpm   # 或：sudo rpm -i ./GitHub.rpm
```

你也可以随时显式指定格式：

```bash
pake https://github.com --name GitHub --targets rpm        # RPM 包
pake https://github.com --name GitHub --targets appimage   # 便携 AppImage
```

默认会构建多个目标，此时单个格式失败不再中断其余格式：如果 `.rpm`/`.deb` 打包失败，
仍会产出 AppImage 作为便携回退方案。AppImage 无需安装即可运行：

```bash
chmod +x ./GitHub.AppImage
./GitHub.AppImage
```

> 构建 `.rpm` 需要 `rpm-build`（`sudo dnf install rpm-build`）。如果你只想要一个可运行
> 的程序而不需要打包，可加上 `--keep-binary`，它会把原始可执行文件复制到安装包旁边。

---

### Linux：AppImage 构建失败，提示 "failed to run linuxdeploy"

**问题描述：**
在 Linux 系统（Debian、Ubuntu、Arch 等）上构建 AppImage 时，可能遇到如下错误：

```txt
Error: failed to run linuxdeploy
Error: strip: Unable to recognise the format of the input file
ERROR: Failed to run plugin: gtk
cp: cannot stat '/usr/lib/gdk-pixbuf-2.0/2.10.0': No such file or directory
```

**先判断你遇到的是哪一种失败。** 同样是 `failed to run linuxdeploy`，实际有两类不同原因：

- `strip: Unable to recognise the format of the input file`：strip 不兼容，按解决方案 1 处理。
- `Failed to run plugin: gtk` 且伴随 `cannot stat '/usr/lib/gdk-pixbuf-2.0/...'`：linuxdeploy 的 gtk 插件找不到 gdk-pixbuf loaders，`NO_STRIP` 无效。安装 loaders、刷新缓存后重新构建：

```bash
# Arch
sudo pacman -S gdk-pixbuf2 librsvg
# Debian / Ubuntu
sudo apt install librsvg2-common gdk-pixbuf2.0-bin
# 刷新 loader 缓存后重新构建
gdk-pixbuf-query-loaders --update-cache
```

**解决方案 1：自动 NO_STRIP 重试（推荐）**

Pake CLI 已在 linuxdeploy 剥离失败时自动使用 `NO_STRIP=1` 进行二次构建。如果你希望一开始就跳过剥离步骤（或在脚本中使用），可以手动设置该变量：

```bash
NO_STRIP=1 pake https://example.com --name MyApp --targets appimage
```

这会绕过经常在某些 Linux 发行版上出现问题的库文件剥离过程。

**解决方案 2：安装系统依赖**

如果 NO_STRIP 不起作用，确保已安装所有必需的系统依赖：

```bash
sudo apt update
sudo apt install -y \
  libdbus-1-dev \
  libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl wget file \
  libxdo-dev \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  gnome-video-effects \
  libglib2.0-dev \
  libgirepository1.0-dev \
  pkg-config
```

然后再次尝试构建（也可以提前设置 `NO_STRIP=1`）。

**解决方案 3：改用 DEB 格式**

DEB 包在基于 Debian 的系统上更稳定：

```bash
pake https://example.com --name MyApp --targets deb
```

**解决方案 4：使用 Docker（需开放 FUSE）**

在干净的环境中构建，无需安装依赖。AppImage 工具需要访问 `/dev/fuse`，因此需要以特权模式运行（或显式授权 FUSE）：

```bash
docker run --rm --privileged \
  --device /dev/fuse \
  --security-opt apparmor=unconfined \
  -v $(pwd)/output:/output \
  ghcr.io/tw93/pake:latest \
  https://example.com --name MyApp --targets appimage
```

> **提示：** 生成的 AppImage 可能属于 root，需要执行 `sudo chown $(id -nu):$(id -ng) ./output/MyApp.AppImage` 调整所有权。

**原因：**

这是 Tauri 的 linuxdeploy 工具的已知问题，在以下情况下可能失败：

- 系统库的格式不兼容剥离操作
- 在较新的发行版上构建（Arch、Debian Trixie 等）
- 缺少 WebKit2GTK 或 GTK 开发库

`NO_STRIP=1` 环境变量是 Tauri 社区推荐的官方解决方法。

---

### Linux：AppImage 启动即崩溃，提示找不到 WebKitNetworkProcess

**问题描述：**
AppImage 构建成功，但启动时立即崩溃：

```txt
** ERROR **: Unable to spawn a new child process: Failed to spawn child process
"././/lib/webkit2gtk-4.1/WebKitNetworkProcess" (No such file or directory)
```

这只影响在非 Debian 发行版（Arch、Fedora 等）本地构建出来的 AppImage。Pake 官方发布的 AppImage 在基于 Debian 的环境中构建，不受影响。

**原因：**
这是 Tauri 打包器的上游限制（[tauri-apps/tauri#5292](https://github.com/tauri-apps/tauri/issues/5292)）。打包时 Tauri 会把编译进 `libwebkit2gtk*.so` 的 WebKit 辅助进程绝对路径改写成相对的 `././...` 形式，并按 Debian 的库布局（`/usr/lib/<架构三元组>/webkit2gtk-4.1`）复制这些辅助二进制。Arch 上 WebKit 位于 `/usr/lib/webkit2gtk-4.1`，没有架构三元组，于是改写后的相对路径指向了 bundle 内并不存在的 `lib/webkit2gtk-4.1` 目录，`WebKitNetworkProcess` 永远找不到。Pake 不参与这一步：AppDir 布局和路径改写完全由 `tauri build` 生成。

**解决方案 1：使用 Arch 原生包（Arch 上推荐）**

```bash
pake https://example.com --name MyApp --targets zst
```

这会生成 pacman 包（`*.pkg.tar.zst`），安装到系统路径，WebKit 按系统原生路径解析辅助进程，不存在重定位问题。用 `sudo pacman -U MyApp-*.pkg.tar.zst` 安装。

**解决方案 2：在 Docker（基于 Debian）中构建 AppImage**

在 Pake 的 Docker 镜像中构建，库布局正好符合 AppImage 打包器的预期：

```bash
docker run --rm --privileged \
  --device /dev/fuse \
  --security-opt apparmor=unconfined \
  -v $(pwd)/output:/output \
  ghcr.io/tw93/pake:latest \
  https://example.com --name MyApp --targets appimage
```

**已构建 AppImage 的临时绕过方法：**
解压后补上缺失的软链接，再运行内部的 `AppRun`：

```bash
./MyApp.AppImage --appimage-extract
cd squashfs-root
mkdir -p lib && ln -s ../usr/lib/webkit2gtk-4.1 lib/webkit2gtk-4.1
./AppRun
```

---

### Linux：AppImage 打开后按钮或键盘在 Wayland 下不可用

**问题描述：**
在某些纯 Wayland 合成器上，尤其是 niri，AppImage 可以打开，但页面按钮无法点击，键盘输入也无法进入 webview。

**解决方案：**
Pake 会在 niri 会话中自动避开保守的 WebKit 渲染参数。也可以手动强制使用原生 WebKit 渲染路径：

```bash
PAKE_LINUX_WEBKIT_SAFE_MODE=0 ./MyApp.AppImage
```

如果你的系统反而出现白屏，可以重新启用保守 WebKit workaround：

```bash
PAKE_LINUX_WEBKIT_SAFE_MODE=1 ./MyApp.AppImage
```

**原因：**
Pake 默认启用的 WebKitGTK workaround 可以缓解 Linux 白屏，但在部分 Wayland 合成器上，这些参数可能导致输入和窗口控件不可用。`PAKE_LINUX_WEBKIT_SAFE_MODE` 可以按当前合成器选择更合适的渲染模式。

---

### Linux:"cargo: command not found" 即使已安装 Rust

**问题描述：**
已安装 Rust 但 Pake 仍然提示 "cargo: command not found"。

**解决方案：**

Pake CLI 会自动重新加载 Rust 环境，但如果问题仍然存在：

```bash
# 在当前终端重新加载环境
source ~/.cargo/env

# 或者重启终端
```

然后再次尝试构建。

---

### Windows：首次构建时安装超时

**问题描述：**
在 Windows 上首次构建时，可能遇到：

```txt
Error: Command timed out after 900000ms: "cd ... && pnpm install"
```

**原因分析：**

Windows 首次安装可能较慢，原因包括：

- 本地模块编译（需要 Visual Studio Build Tools）
- 大量依赖下载（Tauri、Rust 工具链）
- Windows Defender 实时扫描
- 网络连接问题

**解决方案 1：显式启用国内镜像**

Pake CLI 默认使用官方 npm 和 Rust 源。如果在国内下载较慢，可以显式启用国内镜像：

```bash
# macOS/Linux
PAKE_USE_CN_MIRROR=1 pake https://github.com --name GitHub
```

```powershell
# Windows PowerShell
$env:PAKE_USE_CN_MIRROR="1"; pake https://github.com --name GitHub
```

**解决方案 2：手动安装依赖**

如果依赖安装仍然失败，可手动安装依赖：

```bash
# 进入 pake-cli 安装目录
cd %LOCALAPPDATA%\pnpm\global\5\.pnpm\pake-cli@版本号\node_modules\pake-cli

# 使用国内镜像安装
pnpm install --registry=https://registry.npmmirror.com

# 然后重新构建
pake https://github.com --name GitHub
```

**解决方案 3：改善网络环境**

- 使用稳定的网络连接
- 安装过程中临时关闭杀毒软件
- 必要时使用 VPN 或代理

**预期时间：**

- 首次安装：Windows 上需要 10-15 分钟
- 后续构建：依赖已缓存，速度会快很多

---

### Windows：缺少 Visual Studio 构建工具

**问题描述：**
构建失败，提示缺少 MSVC 或 Windows SDK。

**解决方案：**

安装 Visual Studio 构建工具：

1. 下载 [Visual Studio Build Tools](https://visualstudio.microsoft.com/zh-hans/downloads/#build-tools-for-visual-studio-2022)
2. 安装时选择"使用 C++ 的桌面开发"
3. ARM64 支持：在"单个组件"下额外选择"MSVC v143 - VS 2022 C++ ARM64 构建工具"

---

### macOS：构建失败，出现模块编译错误

**问题描述：**
在 macOS 26 Beta 或更新版本上，可能看到与 `CoreFoundation` 或 `_Builtin_float` 模块相关的错误。

**解决方案：**

创建配置文件以使用兼容的 SDK：

```bash
cat > src-tauri/.cargo/config.toml << 'EOF'
[env]
MACOSX_DEPLOYMENT_TARGET = "15.0"
SDKROOT = "/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk"
EOF
```

此文件已在 `.gitignore` 中，不会被提交。

---

## 运行时问题

### 应用窗口太小/太大

**解决方案：**

构建时指定自定义尺寸：

```bash
pake https://example.com --width 1200 --height 800
```

查看 [CLI 使用指南](cli-usage_CN.md#窗口选项) 了解所有窗口选项。

---

### 应用图标显示不正确

**问题描述：**
自定义图标没有显示或显示默认图标。

**解决方案：**

确保为您的平台使用正确的图标格式：

- **macOS**：`.icns` 格式
- **Windows**：`.ico` 格式
- **Linux**：`.png` 格式

```bash
# macOS
pake https://example.com --icon ./icon.icns

# Windows
pake https://example.com --icon ./icon.ico

# Linux
pake https://example.com --icon ./icon.png
```

Pake 可以自动转换图标，但提供正确的格式更可靠。

---

### 网站功能不工作（登录、上传等）

**问题描述：**
某些网站功能在 Pake 应用中无法工作。

**解决方案：**

这通常是由于 Web 兼容性问题。尝试：

1. **设置自定义 User Agent：**

   ```bash
   pake https://example.com --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
   ```

2. **注入自定义 JavaScript：**

   ```bash
   pake https://example.com --inject ./fix.js
   ```

   对于需要定时刷新的页面，建议把这类行为放在一个小的注入脚本里，而不是增加专门的 Pake 参数：

   ```javascript
   function isEditing(element) {
     if (!element) return false;
     const tagName = element.tagName;
     return (
       element.isContentEditable ||
       tagName === "INPUT" ||
       tagName === "TEXTAREA" ||
       tagName === "SELECT"
     );
   }

   setInterval(() => {
     if (!document.hidden && !isEditing(document.activeElement)) {
       window.location.reload();
     }
   }, 300000);
   ```

   将其保存为 `refresh.js`，然后这样打包：

   ```bash
   pake https://news.ycombinator.com --name HackerNews --inject ./refresh.js
   ```

3. **检查网站是否需要 WebView 中可能不可用的特定权限**

4. **注意嵌入式 WebView 的登录限制**

   某些认证提供方，尤其是 Google，可能会阻止在嵌入式 WebView 中完成登录。由于 Pake 是把网站包装进桌面 WebView，Google 自家站点或依赖 Google OAuth 的网站，即使启用了 `--new-window` 或 `--multi-window`，也仍然可能无法在应用内完成登录。这属于提供方策略限制，不是打包逻辑错误。遇到这种情况时，建议改用普通浏览器、浏览器安装版站点应用，或官方原生桌面客户端。

   在 macOS 上，使用 **Sign in with Apple**（弹窗模式）的站点（例如 Yelp、Upwork）可能在认证后停在白屏。为规避 WebKit 崩溃，Pake 在 macOS 上会把认证 URL 在当前窗口内跳转，这会打断弹窗回调原页面的流程。这类站点请改用普通浏览器或原生 App 登录。

5. **微信 Web 版登录环境异常**

   微信检测到 WebView 后会写入标记 Cookie，导致后续持续被拦截。打包时加 `--incognito` 可解决，代价是每次启动都需要重新扫码登录：

   ```bash
   pake https://wx.qq.com --name WeChat --incognito
   ```

6. **Cloudflare 或人机验证一直循环**

   某些站点（例如 ChatGPT）会在页面前加一层 Cloudflare 验证。系统 WebView，尤其是 Linux 上的 WebKitGTK，经常被这类验证判定为非标准浏览器而一直循环、无法通过，即使加了自定义 `--user-agent` 也无效。这是验证服务在识别浏览器引擎，不是 Pake 的 bug，Pake 侧没有可靠的绕过手段。遇到强制此类验证的站点，建议改用普通浏览器或官方原生客户端。

---

### 应用占用内存比预期高

**问题：**
应用会启动一个 WebKitWebProcess（Linux）或 WebContent 进程（macOS），占用几百 MB 内存，看起来和"约 5MB"的说法矛盾。

**说明：**

"约 5MB"指的是安装包/应用在磁盘上的体积，不是运行时内存。运行时 Pake 通过系统 WebView 渲染（Linux 上是 WebKitWebProcess，macOS 上是 WKWebView），这个进程的内存由引擎和你加载的页面决定，不由 Pake 控制。像 Gemini、Slack、ChatGPT 这类重型 SPA，用 GNOME Web 等任意 WebKitGTK 浏览器打开也会占用差不多的内存。Pake 在 WebView 之上几乎不增加额外开销，所以没有能显著降低它的 Pake 侧设置。这是使用系统 WebView 的固有代价，也是换取极小安装体积的取舍。

---

## 安装问题

### 全局安装时权限被拒绝

**问题描述：**
`npm install -g pake-cli` 失败，提示权限错误。

**解决方案：**

使用以下方法之一：

```bash
# 方案 1：使用 npx（无需安装）
npx pake-cli https://example.com

# 方案 2：修复 npm 权限
npm config set prefix ~/.npm-global
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g pake-cli

# 方案 3：使用 pnpm（推荐）
pnpm install -g pake-cli
```

---

## 获取帮助

如果您的问题未在此处涵盖：

1. 查看 [CLI 使用指南](cli-usage_CN.md) 了解详细参数文档
2. 参阅 [高级用法](advanced-usage_CN.md) 了解前置条件和系统设置
3. 搜索 [现有的 GitHub issues](https://github.com/tw93/Pake/issues)
4. [提交新 issue](https://github.com/tw93/Pake/issues/new) 时请包含：
   - 您的操作系统和版本
   - Node.js 和 Rust 版本（`node --version`、`rustc --version`）
   - 完整的错误信息
   - 您使用的构建命令

### Linux: 打包失败，提示 `Can't detect any appindicator library`

**问题描述：**
在 Linux 上打包时，构建失败并显示以下错误：

```txt
Can't detect any appindicator library
```

**原因分析：**
这个错误表示您的 Linux 系统缺少创建“系统托盘图标”所需的核心库 `libappindicator`。Pake 打包的应用支持系统托盘功能，因此该库是必需的。

**解决方案：**
您需要在您的 Linux 系统上安装这个缺失的开发库。

- **对于 Debian / Ubuntu 系统：**

  ```bash
  sudo apt-get update && sudo apt-get install -y libappindicator3-dev
  ```

- **对于 Fedora / CentOS / RHEL 系统：**

  ```bash
  sudo dnf install -y libappindicator-devel
  ```

为了确保打包环境的完整性，推荐一次性安装所有 Tauri 所需的依赖。请参考本文档中关于 `failed to run linuxdeploy` 问题的解决方案，其中包含了完整的依赖列表。
