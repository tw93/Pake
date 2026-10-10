# CLI 使用指南

<div align="center">

[English](cli-usage.md) · **中文**

</div>

完整的命令行参数说明和基础用法指南。

## 安装

确保 Node.js 版本 ≥20.9.0。

**推荐方式 (pnpm)：**

```bash
pnpm install -g pake-cli
```

**备选方式 (npm)：**

```bash
npm install -g pake-cli
```

**如果遇到权限问题：**

```bash
# 使用 npx 运行，无需全局安装
npx pake-cli [url] [选项]

# 或者永久修复 npm 权限
npm config set prefix ~/.npm-global
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

**前置条件：**

- Node.js ≥20.9.0
- Rust ≥1.85.0（如缺失将自动安装）
- **macOS/Linux**：`curl`、`wget`、`file` 和 `tar`（用于依赖管理）

## 快速开始

```bash
# 基础用法 - 自动获取网站图标
pake https://github.com --name "GitHub"

# 高级用法：自定义选项
pake https://weekly.tw93.fun --name "Weekly" --icon https://cdn.tw93.fun/pake/weekly.icns --width 1200 --height 800 --hide-title-bar

# 完整示例：多个选项组合使用
pake https://github.com --name "GitHub Desktop" --width 1400 --height 900 --show-system-tray --debug
```

## 命令行使用

```bash
pake [url] [options]
```

打包结果默认保存在当前工作目录。首次打包要准备构建环境，会慢一些，后续打包就快了。

> **macOS 输出**：在 macOS 上，Pake 默认创建 DMG 安装程序。如需创建 `.app` 包进行测试（避免交互），可设置环境变量 `PAKE_CREATE_APP=1`。如果希望 Pake 直接将应用安装到 `/Applications`，可以使用 `--install`；该选项会构建 `.app`、复制到 `/Applications`，并在安装成功后删除当前目录中的本地 `.app`。
>
> **注意**：打包过程需要使用 `Rust` 环境。如果未安装 `Rust`，系统会提示是否安装。如遇安装失败或超时，可参考指南 [手动安装](https://www.rust-lang.org/tools/install)。

### [url]

`url` 是需要打包的网页链接、本地 HTML 文件的路径，或包含根级 `index.html` 的静态文件目录（例如构建产物 `dist/`）。除非通过 `--config` 文件提供 `url`，此参数为必填。

网页应用会在关闭或退出时记住主窗口的完整网址，下次启动时恢复；没有记录时打开打包网址，回到首页仍使用打包网址，隐身模式和本地 HTML 应用不保存或恢复网址。

```shell
pake https://example.com --name Example
pake ./page.html --name MyPage
pake ./dist --name MyTool
```

本地打包开箱支持 hash 路由；history 模式的 SPA 路由暂不支持。

### [options]

可以通过传递以下选项来定制打包过程。`pake --help` 展示全部支持的 CLI 选项。本文档是完整参考。

| 选项                        | 描述                                 | 示例                                           |
| --------------------------- | ------------------------------------ | ---------------------------------------------- |
| `--name`                    | 应用程序名称                         | `--name "Weekly"`                              |
| `--icon`                    | 自定义图标（可选，自动获取网站图标） | `--icon https://cdn.tw93.fun/pake/weekly.icns` |
| `--width`                   | 窗口宽度（默认：1200px）             | `--width 1400`                                 |
| `--height`                  | 窗口高度（默认：780px）              | `--height 900`                                 |
| `--hide-title-bar`          | 沉浸式标题栏（仅 macOS）             | `--hide-title-bar`                             |
| `--hide-window-decorations` | 隐藏原生窗口装饰（仅 Windows/Linux） | `--hide-window-decorations`                    |
| `--debug`                   | 启用开发者工具                       | `--debug`                                      |
| `--config`                  | 从 JSON 配置文件读取选项             | `--config app.json`                            |
| `--json`                    | stdout 输出机器可读结果（自动化用）  | `--json`                                       |
| `--help`                    | 显示全部 CLI 选项                    | `--help`                                       |
| `--version`                 | 显示 CLI 版本                        | `--version`                                    |

完整选项请参见下面的详细说明：

#### [name]

指定应用程序的名称，未指定时系统会提示输入，建议使用英文。

**注意**：支持带空格的名称，会自动处理不同平台的命名规范：

- **Windows/macOS**：保持空格和大小写（如 `"Google Translate"`）
- **Linux**：自动转换为小写并用连字符连接（如 `"google-translate"`）

```shell
--name <string>
--name MyApp

# 带空格的名称:
--name "Google Translate"
```

#### [icon]

**可选参数**：未指定时自动抓取网站 Favicon 并转换为目标平台格式。如需自定义图标，可访问 [icon-icons](https://icon-icons.com) 或 [macOSicons](https://macosicons.com/#/) 下载。

支持本地或远程文件，自动转换为平台所需格式：

- macOS：`.icns` 格式
- Windows：`.ico` 格式
- Linux：`.png` 格式

```shell
--icon <path>

# 示例：
# 不传 --icon 参数，自动获取网站图标
pake https://github.com --name GitHub

# 使用自定义图标
--icon ./my-icon.png
--icon https://cdn.tw93.fun/pake/weekly.icns  # 远程图标（.icns 适用于 macOS）
```

#### [height]

设置应用窗口高度，默认为 `780px`。

```shell
--height <number>
```

#### [width]

设置应用窗口宽度，默认为 `1200px`。

```shell
--width <number>
```

#### [min-width]

设置窗口最小宽度，防止缩放过小导致布局错位。

```shell
--min-width <number>
```

#### [min-height]

设置窗口最小高度，防止缩放过小导致内容错乱。

```shell
--min-height <number>
```

#### [zoom]

设置初始页面缩放比例，取值为 50 到 200 之间的整数，默认为 `100`。用户仍可通过快捷键（`Cmd/Ctrl +/-/0`）微调。

```shell
--zoom <number>
--zoom 80   # 80%
--zoom 120  # 120%
```

#### [hide-title-bar]

启用沉浸式标题栏，默认为 `false`。仅对 macOS 有效。

```shell
--hide-title-bar
```

#### [hide-window-decorations]

在 Windows 和 Linux 上隐藏原生窗口装饰，默认为 `false`。该选项会移除标题栏和窗口控制按钮，并在顶部提供拖拽区域以移动窗口。可使用 `F11` 切换原生全屏。在 macOS 上会被忽略。

```shell
--hide-window-decorations
```

#### [fullscreen]

设置应用启动时自动全屏，默认为 `false`。

```shell
--fullscreen
```

#### [maximize]

设置应用启动时最大化窗口，默认为 `false`。

```shell
--maximize
```

#### [activation-shortcut]

设置应用程序的全局激活快捷键。默认为空，可自定义快捷键，如 `CmdOrControl+Shift+P`，格式参考 [available-modifiers](https://www.electronjs.org/docs/latest/api/accelerator#available-modifiers)。

```shell
--activation-shortcut <string>
```

#### [always-on-top]

设置窗口始终置顶，默认为 `false`。

```shell
--always-on-top
```

#### [app-version]

设置应用版本号，遵循 SemVer 规范，默认为 `1.0.0`。

```shell
--app-version <string>
```

#### [dark-mode]

强制打包应用使用深色模式（支持 macOS、Windows 和 Linux），默认为 `false`。

```shell
--dark-mode
```

在 Linux 上深色模式经由 WebKitGTK 实现，页面是否真正渲染为暗色还取决于 WebKitGTK 是否尊重窗口主题以及站点是否实现了 `prefers-color-scheme: dark`。

#### [disabled-web-shortcuts]

禁用 Pake 容器内置的网页快捷键，默认为 `false`。

```shell
--disabled-web-shortcuts
```

#### [enable-find]

启用 Pake 内置的页面查找浮层，默认为 `false`。开启后支持使用 `Cmd/Ctrl+F` 打开查找，`Cmd/Ctrl+G` 跳转到下一个匹配项，`Cmd/Ctrl+Shift+G` 跳转到上一个匹配项。

```shell
--enable-find
```

#### [force-internal-navigation]

强制所有点击的链接（包括跨域链接）都在 Pake 窗口内打开，不再调起外部默认浏览器，默认为 `false`。

```shell
--force-internal-navigation
```

#### [internal-url-regex]

使用正则表达式指定内部链接匹配规则（在应用内打开）。设置后优先于默认域名匹配逻辑，适用于仅允许特定路径在应用内打开的场景。

```shell
--internal-url-regex <pattern>

# 示例：只把 facebook.com/messages 路径视为内部链接
--internal-url-regex "^https://www\\.facebook\\.com/messages(/.*)?$"

# 示例：只把特定子域名视为内部链接
--internal-url-regex "^https://(app|api)\\.example\\.com"
```

#### [safe-domain]

把指定域名及其子域名保留在应用内打开，便于处理企业 SSO 登录与授权跳转（如 Slack 搭配 Okta）。Pake 会把这个列表编译成 `internal_url_regex`；若同时传入 `--internal-url-regex`，则以显式正则为准。

`--safe-domain` 仅匹配 URL Host，不会因路径或 Query 参数中包含域名而发生误判。

```shell
--safe-domain <domains>

# 将 Slack 和 Okta 的认证跳转保留在应用内
--safe-domain slack.com,okta.com
```

#### [multi-arch]

打包同时支持 Intel 与 Apple Silicon 架构的通用二进制，仅适用于 macOS，默认为 `false`。

##### 准备工作

- 注意：启用此选项后，需要使用 Rust 官方 rustup 安装工具链，不支持 Homebrew 安装的 Rust
- Intel 设备需安装 arm64 跨平台 target：

  ```shell
  rustup target add aarch64-apple-darwin
  ```

- Apple Silicon 设备需安装 x86_64 跨平台 target：

  ```shell
  rustup target add x86_64-apple-darwin
  ```

##### 使用方法

```shell
--multi-arch
```

#### [targets]

指定构建目标架构或输出格式：

- **Linux**：`deb`, `appimage`, `rpm`, `zst`, `deb-arm64`, `appimage-arm64`, `rpm-arm64`, `zst-arm64`（默认按发行版自适应：Debian/Ubuntu 为 `deb, appimage`，Fedora/RHEL/openSUSE 等为 `rpm, appimage`）
- **Windows**：`x64`, `arm64`（未指定时自动检测）
- **macOS**：`intel`, `apple`, `universal`（架构，未指定时自动检测）；`app`, `dmg`（输出格式，默认为 `dmg`）

```shell
--targets <target>

# 示例：
--targets arm64          # Windows ARM64
--targets x64            # Windows x64
--targets universal      # macOS 通用版本（Intel + Apple Silicon）
--targets apple          # 仅 macOS Apple Silicon
--targets intel          # 仅 macOS Intel
--targets app            # 仅 macOS 应用包（.app，跳过 DMG 打包）
--targets dmg            # macOS DMG 安装包（默认）
--targets deb            # Linux DEB 包（x64）
--targets rpm            # Linux RPM 包（x64）
--targets appimage       # Linux AppImage（x64）
--targets zst            # Linux Arch 包（x64 .pkg.tar.zst）
--targets deb-arm64      # Linux DEB 包（ARM64）
--targets rpm-arm64      # Linux RPM 包（ARM64）
--targets appimage-arm64 # Linux AppImage（ARM64）
--targets zst-arm64      # Linux Arch 包（ARM64 .pkg.tar.zst）
```

**Linux ARM64 注意事项**：

- 交叉编译需要安装 `gcc-aarch64-linux-gnu` 并配置相应环境变量
- ARM64 支持覆盖 Linux 手机（postmarketOS、Ubuntu Touch）、树莓派及其他 ARM64 Linux 设备
- `--targets appimage-arm64` 可生成兼顾多种 ARM64 Linux 发行版的便携格式
- 基于 Arch Linux 的系统使用 `--targets zst` 可直接生成 `.pkg.tar.zst`，需预先安装 `binutils`（提供 `ar`）和 `libarchive`（提供 `bsdtar`）

#### [windows-toolchain]

选择 Windows 构建使用的 Rust 工具链。仅适用于 Windows，其他平台忽略此选项。

- `msvc`（默认）：Tauri 推荐工具链，需安装 [Visual Studio Build Tools](https://tauri.app/start/prerequisites/#windows)（勾选“使用 C++ 的桌面开发”工作负载）。
- `gnu`：改用 MinGW/MSYS2 工具链构建，适合已安装 Rust 和 GNU 工具链（例如通过 [MSYS2](https://www.msys2.org/)）但没有安装 Visual Studio Build Tools 的机器。仅支持 `x64`（MSYS2 未提供该目标的 ARM64 GCC 工具链）。需要 `PATH` 中包含 `gcc`、`ld` 和 `dlltool`。

```shell
--windows-toolchain <msvc|gnu>

# 示例：使用 MinGW/MSYS2 工具链构建
--windows-toolchain gnu
```

若未检测到 MSVC 但存在可用 GNU 工具链，Pake 会提示使用 `--windows-toolchain gnu`，避免在链接阶段报出晦涩错误。使用 `gnu` 不影响系统全局 Rust 环境设置，仅作用于当次构建进程。

使用 `gnu` 时，可执行文件会在运行时加载 `WebView2Loader.dll`，而不是像 MSVC 那样静态链接。MSI 安装包已包含该文件；`--keep-binary` 会把它复制到 `AppName.exe` 旁边，请将两者放在一起，否则原始可执行文件无法启动。

#### [no-bundle]

跳过打包，只输出编译好的可执行文件。仅 Linux 可用。适用于 Fedora、RHEL、Oracle Linux 等 RPM 系发行版，这些系统上原生打包器可能在打包阶段中止，用此选项仍能拿到可运行的二进制。

```shell
pake https://github.com --name GitHub --no-bundle
```

裸可执行文件会复制到当前目录，命名为 `<name>-binary`。在非 Linux 平台此选项会被忽略。

#### [user-agent]

自定义浏览器 User-Agent 请求头，默认为空。

```shell
--user-agent <string>
```

#### [show-system-tray]

设置应用程序显示在系统托盘，默认为 `false`。

```shell
--show-system-tray
```

#### [system-tray-icon]

设置托盘图标，仅在启用系统托盘时有效。图标必须为 `.ico` 或 `.png` 格式，尺寸应在 32x32 到 256x256 像素之间。

```shell
--system-tray-icon <path>
```

#### [hide-on-close]

点击窗口关闭按钮时隐藏窗口而非退出应用。各平台默认值：macOS 为 `true`，Windows/Linux 为 `false`。

```shell
# 关闭时隐藏（macOS 默认行为）
--hide-on-close
--hide-on-close true

# 立即退出应用（Windows/Linux 默认行为）
--hide-on-close false
```

#### [start-to-tray]

启动时最小化到系统托盘而不展示主窗口。必须与 `--show-system-tray` 搭配使用，默认为 `false`。

```shell
--start-to-tray

# 示例：启动时隐藏到托盘（需搭配 --show-system-tray）
pake https://github.com --name GitHub --show-system-tray --start-to-tray
```

**注意**：双击托盘图标可显示/隐藏窗口。未配置 `--show-system-tray` 时此选项被忽略。

#### [title]

设置窗口标题栏文本，macOS 未指定时不展示标题，Windows/Linux 默认回退为应用名称。

```shell
--title <string>

# 示例：
--title "我的应用"
--title "音乐播放器"
```

#### [incognito]

以无痕模式启动应用，默认为 `false`。启用后不保留 Cookie、Local Storage 和历史记录，适用于注重隐私或临时登录场景。

```shell
--incognito
```

#### [password-autosave]

在 Windows 上启用 WebView2 原生密码保存提示，凭据存储于应用专有配置文件中，不与 Edge/Chrome 共享，默认为 `false`。macOS 与 Linux 忽略此选项；`--incognito` 模式下自动停用。关闭后不会保存新密码，也不会弹出保存或更新提示，但已有密码仍可能自动填充，包括使用同一配置文件的隐私窗口。

```bash
--password-autosave
```

#### [wasm]

启用 WebAssembly 跨域隔离支持（附加 `Cross-Origin-Opener-Policy: same-origin` 和 `Cross-Origin-Embedder-Policy: require-corp` 头部与浏览器标志），适用于 Flutter Web 及依赖 SharedArrayBuffer/WASM 模块的应用，默认为 `false`。

```shell
--wasm

# 示例：打包支持 WASM 的 Flutter Web 应用
pake https://flutter.dev --name FlutterApp --wasm
```

#### [enable-drag-drop]

启用原生拖拽支持，默认为 `false`。支持网页内元素拖拽排序及文件拖入上传等交互。

```shell
--enable-drag-drop

# 示例：打包需要拖拽交互的应用
pake https://planka.example.com --name PlankApp --enable-drag-drop
```

#### [keep-binary]

构建后保留免安装的独立运行文件，默认为 `false`。除各平台标准安装包外，还会在当前目录额外输出二进制（Unix 为 `AppName-binary`，Windows 为 `AppName.exe`）。使用 `--windows-toolchain gnu` 时同步输出 `WebView2Loader.dll`。

```shell
--keep-binary

# 示例：同时生成安装包和独立运行文件
pake https://github.com --name GitHub --keep-binary
```

#### [iterative-build]

开启快速构建模式（仅生成 app，跳过 dmg/deb/msi 打包），适用于调试，默认为 `false`。

```shell
--iterative-build
```

#### [install]

将构建出的 macOS 应用直接安装到 `/Applications`，默认为 `false`。

该选项仅适用于 macOS，适合本地开发和快速验证。启用后，Pake 会构建 `.app` 包，将其复制到 `/Applications`，如果已存在同名应用则先替换，并在安装成功后删除当前工作目录中的本地 `.app`。如果安装失败，当前目录中的 `.app` 会被保留。

```shell
--install

# 示例：构建并直接安装到 /Applications
pake https://github.com --name GitHub --install
```

#### [camera]

在 macOS 上申请摄像头使用权限（添加 `com.apple.security.device.camera` entitlement），默认为 `false`。Windows 和 Linux 忽略此选项。适用于视频通话、扫码等网页场景。

```shell
--camera

# 示例：为视频通话站点打包并开启摄像头权限
pake https://meet.google.com --name Meet --camera
```

#### [microphone]

在 macOS 上申请麦克风使用权限（添加 `com.apple.security.device.audio-input` entitlement），默认为 `false`。Windows 和 Linux 忽略此选项。

```shell
--microphone

# 示例：为会议类应用同时开启摄像头与麦克风权限
pake https://meet.google.com --name Meet --camera --microphone
```

#### [multi-instance]

允许打包后的应用同时运行多个进程实例，默认为 `false`（默认仅聚焦已启动的窗口）。

```shell
--multi-instance

# 示例：允许多开聊天应用实例
pake https://chat.example.com --name ChatApp --multi-instance
```

#### [multi-window]

允许在单进程实例内打开多个窗口，默认为 `false`。

与 `--multi-instance` 的区别：

- `--multi-instance`：启动多个独立应用进程
- `--multi-window`：单进程内创建并维护多个窗口

启用后，如果应用已在运行，再次启动会新开一个窗口，而不是仅聚焦已有窗口。

在 macOS 上，通过 Cmd+N 打开的附加窗口会自动加入应用的原生标签页组；网页认证和 `window.open` 弹窗仍保持独立。

此选项可优化弹窗授权体验，但无法绕过提供方自身的策略限制（部分提供方如 Google 仍可能拒绝在嵌入式 WebView 中登录）。

```shell
--multi-window

# 示例：单进程多窗口模式
pake https://chat.example.com --name ChatApp --multi-window
```

#### [installer-language]

设置 Windows 安装包界面语言，支持 `zh-CN`、`ja-JP` 等（详见 [Tauri 国际化文档](https://v2.tauri.app/distribute/windows-installer/#internationalization)），默认为 `en-US`。

```shell
--installer-language <language>
```

#### [use-local-file]

当 `url` 为本地文件路径时，如果启用此选项，则会递归地将 `url` 路径文件所在的文件夹及其所有子文件复制到 Pake 的静态文件夹。默认不启用。

目录输入（如 `pake ./dist`）始终打包整个目录树，此选项仅影响单个 HTML 文件输入。

```shell
--use-local-file

# 基础静态文件打包
pake ./my-app/index.html --name "my-app" --use-local-file
```

#### [inject]

向页面注入本地 CSS 或 JavaScript 脚本，实现样式定制、脚本注入或广告拦截等能力。编写一次即可复用到多个打包应用中。

支持逗号分隔和多个选项两种格式：

```shell
# 逗号分隔（推荐）
--inject ./tools/style.css,./tools/hotkey.js

# 多个选项
--inject ./tools/style.css --inject ./tools/hotkey.js

# 单个文件
--inject ./tools/style.css
```

#### [download-dir]

指定打包后应用的默认下载目录，普通链接下载和浏览器原生下载都用这个目录，未指定时沿用系统 Downloads 目录。

```bash
pake https://example.com --name MyApp --download-dir '~/Documents/MyApp'
```

支持绝对路径（如 Windows 的 `C:\Users\Alice\Documents\MyApp`）或带引号的 `~/路径`，引号可保留 `~`，让它在应用运行时指向使用者的主目录，而非打包机器的主目录。目录不存在时会在首次下载时创建；不支持相对路径，目录不可访问时下载会失败，不会悄悄改存到其他位置。JSON 配置对应字段为 `downloadDir`，修改已有应用的下载目录需重新打包。

#### [proxy-url]

为所有网络请求配置代理服务器，支持 HTTP、HTTPS 和 SOCKS5。在 Windows 与 Linux 上直接可用，macOS 需 macOS 14+。

```shell
--proxy-url http://127.0.0.1:7890
--proxy-url socks5://127.0.0.1:7891
```

#### [basic-auth]

当目标站点请求 HTTP Basic 认证时弹出原生凭据输入框。仅用于 macOS（WKWebView 默认不显示 401 登录框）。凭据在运行时输入，仅保留在当前会话中。

```shell
--basic-auth
```

#### [debug]

启用开发者工具与详细调试日志。

```shell
--debug
```

#### [config]

使用声明式 JSON 配置文件代替命令行参数拼接。字段名为 camelCase 格式的 CLI 选项名，外加 `url`；详见 [schema/pake.schema.json](../schema/pake.schema.json)。显式传入的命令行参数优先级始终高于配置文件。未知字段、类型错误或超范围数值会立即报错。相对路径形式的 `url` 相对当前工作目录解析，而非配置文件所在目录。调用参数（`--json`、`--config`、`--version`）不允许写进配置文件。

```shell
--config <path>

# app.json
# {
#   "$schema": "https://raw.githubusercontent.com/tw93/Pake/main/schema/pake.schema.json",
#   "url": "https://example.com",
#   "name": "MyApp",
#   "width": 1280,
#   "hideTitleBar": true
# }
pake --config app.json
```

#### [json]

面向脚本与 AI agent 的机器可读模式。所有日志改走 stderr，stdout 只输出一个 JSON 结果对象；交互式提示全部禁用（stdin 非 TTY 时同样禁用）。

```shell
--json

# 成功（stdout）：
# {"ok":true,"name":"MyApp","platform":"darwin","arch":"arm64",
#  "outputs":[{"path":"/abs/MyApp.dmg","sizeBytes":5242880,"format":"dmg"}],
#  "warnings":[],"error":null}
#
# 失败（stdout）：
# {"ok":false, ..., "error":{"code":"ENV_MISSING","message":"...","hint":"..."}}
```

退出码：`0` 成功、`2` 输入非法、`3` 构建失败、`4` 环境缺失或依赖安装失败（如未安装 Rust、依赖安装出错）、`1` 未预期错误。错误码：`INVALID_INPUT`、`ENV_MISSING`、`BUILD_FAILED`、`UNEXPECTED`，另有 `NETWORK`（预留，当前版本的网络失败会按所处阶段归入 `ENV_MISSING` 或 `BUILD_FAILED`）。

Linux 多 target 构建（如 `--targets deb,appimage`）时，若单个 target 失败而其他成功，会记入 `warnings`，此时 `ok` 仍为 true。请通过 `outputs[].format` 确认产物完整性。

#### [ignore-certificate-errors]

忽略目标 URL 的 TLS 证书校验错误，适用于内网环境、本地开发与自签名证书。

```shell
--ignore-certificate-errors
```

#### [new-window]

允许网页唤起新窗口（如 OAuth 登录弹窗、新标签页或会话窗口）。

此选项有助于需要弹出授权窗口的站点，但能否在应用内完成登录仍取决于目标服务方的安全策略（部分服务商如 Google 可能会主动限制在嵌入式 WebView 中授权）。

```shell
--new-window
```

## Docker 使用

```shell
# 在 Linux 上通过 Docker 运行 Pake CLI（AppImage 构建需 FUSE 权限）
docker run --rm --privileged \
    --device /dev/fuse \
    --security-opt apparmor=unconfined \
    -v YOUR_DIR:/output \
    ghcr.io/tw93/pake \
    <arguments>

# 示例：
docker run --rm --privileged \
    --device /dev/fuse \
    --security-opt apparmor=unconfined \
    -v ./packages:/output \
    ghcr.io/tw93/pake \
    https://example.com --name MyApp --icon ./icon.png --targets appimage
```
