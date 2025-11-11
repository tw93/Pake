# CLI 使用指南

<h4 align="right"><strong><a href="cli-usage.md">English</a></strong> | 简体中文</h4>

完整的命令行参数说明和基础用法指南。

## 安装

请确保您的 Node.js 版本为 22 或更高版本（例如 22.11.0）。_注意：较旧的版本 ≥18.0.0 也可能可以工作。_

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

- Node.js ≥18.0.0
- Rust ≥1.78.0（如缺失将自动安装）
- **Windows/Linux**：详细系统依赖请参考 [高级用法指南](advanced-usage_CN.md#前置条件)

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

应用程序的打包结果将默认保存在当前工作目录。由于首次打包需要配置环境，这可能需要一些时间，请耐心等待。

> **macOS 输出**：在 macOS 上，Pake 默认创建 DMG 安装程序。如需创建 `.app` 包进行测试（避免用户交互），请设置环境变量 `PAKE_CREATE_APP=1`。
>
> **注意**：打包过程需要使用 `Rust` 环境。如果您没有安装 `Rust`，系统会提示您是否要安装。如果遇到安装失败或超时的问题，您可以 [手动安装](https://www.rust-lang.org/tools/install)。

### [url]

`url` 是您需要打包的网页链接 🔗 或本地 HTML 文件的路径，此参数为必填。

### [options]

您可以通过传递以下选项来定制打包过程。以下是最常用的选项：

| 选项               | 描述                                 | 示例                                           |
| ------------------ | ------------------------------------ | ---------------------------------------------- |
| `--name`           | 应用程序名称                         | `--name "Weekly"`                              |
| `--icon`           | 自定义图标（可选，自动获取网站图标） | `--icon https://cdn.tw93.fun/pake/weekly.icns` |
| `--width`          | 窗口宽度（默认：1200px）             | `--width 1400`                                 |
| `--height`         | 窗口高度（默认：780px）              | `--height 900`                                 |
| `--hide-title-bar` | 沉浸式标题栏（仅macOS）              | `--hide-title-bar`                             |
| `--debug`          | 启用开发者工具                       | `--debug`                                      |

完整选项请参见下面的详细说明：

#### [name]

指定应用程序的名称，如果未指定，系统会提示您输入，建议使用英文单词。

**注意**: 支持带空格的名称，会自动处理不同平台的命名规范:

- **Windows/macOS**: 保持空格和大小写（如 `"Google Translate"`）
- **Linux**: 自动转换为小写并用连字符连接（如 `"google-translate"`）

```shell
--name <string>
--name MyApp

# 带空格的名称:
--name "Google Translate"
```

#### [icon]

**可选参数**：不传此参数时，Pake 会自动获取网站图标并转换为对应格式。如需自定义图标，可访问 [icon-icons](https://icon-icons.com) 或 [macOSicons](https://macosicons.com/#/) 下载。

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
--icon https://cdn.tw93.fun/pake/weekly.icns  # 远程图标（.icns适用于macOS）
```

#### [height]

设置应用窗口的高度，默认为 `780px`。

```shell
--height <number>
```

#### [width]

设置应用窗口的宽度，默认为 `1200px`。

```shell
--width <number>
```

#### [hide-title-bar]

设置是否启用沉浸式头部，默认为 `false`（不启用）。当前只对 macOS 上有效。

```shell
--hide-title-bar
```

#### [fullscreen]

设置应用程序是否在启动时自动全屏，默认为 `false`。使用以下命令可以设置应用程序启动时自动全屏。

```shell
--fullscreen
```

#### [maximize]

设置应用程序是否在启动时最大化窗口，默认为 `false`。使用以下命令可以设置应用程序启动时窗口最大化。

```shell
--maximize
```

#### [activation-shortcut]

设置应用程序的激活快捷键。默认为空，不生效，可以使用以下命令自定义激活快捷键，例如 `CmdOrControl+Shift+P`，使用可参考 [available-modifiers](https://www.electronjs.org/docs/latest/api/accelerator#available-modifiers)。

```shell
--activation-shortcut <string>
```

#### [always-on-top]

设置是否窗口一直在最顶层，默认为 `false`。

```shell
--always-on-top
```

#### [app-version]

设置打包应用的版本号，和 package.json 里面 version 命名格式一致，默认为 `1.0.0`。

```shell
--app-version <string>
```

#### [dark-mode]

强制 Mac 打包应用使用黑暗模式，默认为 `false`。

```shell
--dark-mode
```

#### [disabled-web-shortcuts]

设置是否禁用原有 Pake 容器里面的网页操作快捷键，默认为 `false`。

```shell
--disabled-web-shortcuts
```

#### [force-internal-navigation]

启用后所有点击的链接（即使是跨域）都会在 Pake 窗口内打开，不会再调用外部浏览器或辅助程序。默认 `false`。

```shell
--force-internal-navigation
```

#### [multi-arch]

设置打包结果同时支持 Intel 和 M1 芯片，仅适用于 macOS，默认为 `false`。

##### 准备工作

- 注意：启用此选项后，需要使用 rust 官网的 rustup 安装 rust，不支持通过 brew 安装。
- 对于 Intel 芯片用户，需要安装 arm64 跨平台包，以使安装包支持 M1 芯片。使用以下命令安装：

  ```shell
  rustup target add aarch64-apple-darwin
  ```

- 对于 M1 芯片用户，需要安装 x86 跨平台包，以使安装包支持 Intel 芯片。使用以下命令安装：

  ```shell
  rustup target add x86_64-apple-darwin
  ```

##### 使用方法

```shell
--multi-arch
```

#### [targets]

指定构建目标架构或格式：

- **Linux**: `deb`, `appimage`, `deb-arm64`, `appimage-arm64`（默认：`deb`）
- **Windows**: `x64`, `arm64`（未指定时自动检测）
- **macOS**: `intel`, `apple`, `universal`（未指定时自动检测）

```shell
--targets <target>

# 示例：
--targets arm64          # Windows ARM64
--targets x64            # Windows x64
--targets universal      # macOS 通用版本（Intel + Apple Silicon）
--targets apple          # 仅 macOS Apple Silicon
--targets intel          # 仅 macOS Intel
--targets deb            # Linux DEB 包（x64）
--targets rpm            # Linux RPM 包（x64）
--targets appimage       # Linux AppImage（x64）
--targets deb-arm64      # Linux DEB 包（ARM64）
--targets rpm-arm64      # Linux RPM 包（ARM64）
--targets appimage-arm64 # Linux AppImage（ARM64）
```

**Linux ARM64 注意事项**：

- 交叉编译需要额外设置。需要安装 `gcc-aarch64-linux-gnu` 并配置交叉编译环境变量。
- ARM64 支持让 Pake 应用可以在基于 ARM 的 Linux 设备上运行，包括 Linux 手机（postmarketOS、Ubuntu Touch）、树莓派和其他 ARM64 Linux 系统。
- 使用 `--target appimage-arm64` 可以创建便携式 ARM64 应用，在不同的 ARM64 Linux 发行版上运行。

#### [user-agent]

自定义浏览器的用户代理请求头，默认为空。

```shell
--user-agent <string>
```

#### [show-system-tray]

设置应用程序显示在系统托盘，默认为 `false`。

```shell
--show-system-tray
```

#### [system-tray-icon]

设置通知栏托盘图标，仅在启用通知栏托盘时有效。图标必须为 `.ico` 或 `.png` 格式，分辨率为 32x32 到 256x256 像素。

```shell
--system-tray-icon <path>
```

#### [hide-on-close]

点击关闭按钮时隐藏窗口而不是退出应用程序。平台特定默认值：macOS 为 `true`，Windows/Linux 为 `false`。

```shell
# 关闭时隐藏（macOS 默认行为）
--hide-on-close
--hide-on-close true

# 立即关闭应用程序（Windows/Linux 默认行为）
--hide-on-close false
```

#### [start-to-tray]

启动时将应用程序最小化到系统托盘而不是显示窗口。必须与 `--show-system-tray` 一起使用。默认为 `false`。

```shell
--start-to-tray

# 示例：启动时隐藏到托盘（必须与 --show-system-tray 一起使用）
pake https://github.com --name GitHub --show-system-tray --start-to-tray
```

**注意**：双击托盘图标可以显示/隐藏窗口。如果不与 `--show-system-tray` 一起使用，此选项将被忽略。

#### [title]

设置窗口标题栏文本，macOS 未指定时不显示标题，Windows/Linux 回退使用应用名称。

```shell
--title <string>

# 示例：
--title "我的应用"
--title "音乐播放器"
```

#### [incognito]

以隐私/隐身浏览模式启动应用程序。默认为 `false`。启用后，webview 将在隐私模式下运行，这意味着它不会存储 cookie、本地存储或浏览历史记录。这对于注重隐私的应用程序很有用。

```shell
--incognito
```

#### [wasm]

启用 WebAssembly 支持，添加跨域隔离头部，适用于 Flutter Web 应用以及其他使用 WebAssembly 模块（如 `sqlite3.wasm`、`canvaskit.wasm`）的 Web 应用，默认为 `false`。

此选项会添加必要的 HTTP 头部（`Cross-Origin-Opener-Policy: same-origin` 和 `Cross-Origin-Embedder-Policy: require-corp`）以及浏览器标志，以启用 SharedArrayBuffer 和 WebAssembly 功能。

```shell
--wasm

# 示例：打包支持 WASM 的 Flutter Web 应用
pake https://flutter.dev --name FlutterApp --wasm
```

#### [enable-drag-drop]

启用原生拖拽功能。默认为 `false`。启用后，允许在应用中进行拖拽操作，如重新排序项目、文件上传以及其他在常规浏览器中有效的交互式拖拽行为。

```shell
--enable-drag-drop

# 示例：打包需要拖拽功能的应用
pake https://planka.example.com --name PlankApp --enable-drag-drop
```

#### [keep-binary]

保留原始二进制文件与安装包一起。默认为 `false`。启用后，除了平台特定的安装包外，还会输出一个可独立运行的可执行文件。

```shell
--keep-binary

# 示例：同时生成安装包和独立可执行文件
pake https://github.com --name GitHub --keep-binary
```

**输出结果**：同时创建安装包和独立可执行文件（Unix 系统为 `AppName-binary`，Windows 为 `AppName.exe`）。

#### [multi-instance]

允许打包后的应用同时运行多个实例。默认为 `false`，此时再次启动只会聚焦已有窗口。启用该选项后，可以同时打开同一个应用的多个窗口。

```shell
--multi-instance

# 示例：允许聊天应用同时开多个窗口
pake https://chat.example.com --name ChatApp --multi-instance
```

#### [installer-language]

设置 Windows 安装包语言。支持 `zh-CN`、`ja-JP`，更多在 [Tauri 文档](https://tauri.app/distribute/windows-installer/#internationalization)。默认为 `en-US`。

```shell
--installer-language <language>
```

#### [use-local-file]

当 `url` 为本地文件路径时，如果启用此选项，则会递归地将 `url` 路径文件所在的文件夹及其所有子文件复制到 Pake 的静态文件夹。默认不启用。

```shell
--use-local-file

# 基础静态文件打包
pake ./my-app/index.html --name "my-app" --use-local-file
```

#### [inject]

使用 `inject` 可以通过本地的绝对、相对路径的 `css` `js` 文件注入到你所指定 `url` 的页面中，从而为其做定制化改造。举个例子：一段可以通用到任何网页的广告屏蔽脚本，或者是优化页面 `UI` 展示的 `css`，你只需要书写一次可以将其通用到任何其他网页打包的 `app`。

支持逗号分隔和多个选项两种格式：

```shell
# 逗号分隔（推荐）
--inject ./tools/style.css,./tools/hotkey.js

# 多个选项
--inject ./tools/style.css --inject ./tools/hotkey.js

# 单个文件
--inject ./tools/style.css
```

#### [proxy-url]

为所有网络请求设置代理服务器。支持 HTTP、HTTPS 和 SOCKS5。在 Windows 和 Linux 上可用。在 macOS 上需要 macOS 14+。

```shell
--proxy-url http://127.0.0.1:7890
--proxy-url socks5://127.0.0.1:7891
```

#### [debug]

启用开发者工具和详细日志输出，用于调试。

```shell
--debug
```

### 打包完成

完成上述步骤后，您的应用程序应该已经成功打包。请注意，根据您的系统配置和网络状况，打包过程可能需要一些时间。请耐心等待，一旦打包完成，您就可以在指定的目录中找到应用程序安装包。

## Docker 使用

```shell
# 在 Linux 上通过 Docker 运行 Pake CLI（AppImage 构建需要 FUSE 权限）
docker run --rm --privileged \
    --device /dev/fuse \
    --security-opt apparmor=unconfined \
    -v YOUR_DIR:/output \
    ghcr.io/tw93/pake \
    <arguments>

# 例如：
docker run --rm --privileged \
    --device /dev/fuse \
    --security-opt apparmor=unconfined \
    -v ./packages:/output \
    ghcr.io/tw93/pake \
    https://example.com --name MyApp --icon ./icon.png --targets appimage
```
