<h4 align="right"><strong><a href="cli-usage.md">English</a></strong> | 简体中文</h4>

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

<details>
<summary><strong>Windows/Linux 注意事项</strong></summary>

- **非常重要**：请参阅 Tauri 的 [依赖项指南](https://tauri.app/start/prerequisites/)。
- 对于 Windows 用户，请确保至少安装了 `Win10 SDK(10.0.19041.0)` 和 `Visual Studio Build Tools 2022（版本 17.2 或更高）`，此外还需要安装以下组件：
  1. Microsoft Visual C++ 2015-2022 Redistributable (x64)
  2. Microsoft Visual C++ 2015-2022 Redistributable (x86)
  3. Microsoft Visual C++ 2012 Redistributable (x86)（可选）
  4. Microsoft Visual C++ 2013 Redistributable (x86)（可选）
  5. Microsoft Visual C++ 2008 Redistributable (x86)（可选）

  **Windows ARM（ARM64）支持**：在 Visual Studio Installer 中的"单个组件"下安装"MSVC v143 - VS 2022 C++ ARM64 构建工具"。系统会自动检测 ARM64 架构并构建原生 ARM64 二进制文件。

- 对于 Ubuntu 用户，在开始之前，建议运行以下命令以安装所需的依赖项：

  ```bash
  sudo apt install libdbus-1-dev \
      libsoup-3.0-dev \
      libjavascriptcoregtk-4.1-dev \
      libwebkit2gtk-4.1-dev \
      build-essential \
      curl \
      wget \
      libssl-dev \
      libgtk-3-dev \
      libayatana-appindicator3-dev \
      librsvg2-dev \
      gnome-video-effects \
      gnome-video-effects-extra
  ```

</details>

## 快速开始

```bash
# 基础用法 - 只需要提供URL
pake https://weekly.tw93.fun --name "Weekly"

# 自定义图标和窗口大小（macOS示例）
pake https://weekly.tw93.fun --name "Weekly" --icon https://cdn.tw93.fun/pake/weekly.icns --width 1200 --height 800

# macOS 沉浸式体验
pake https://weekly.tw93.fun --name "Weekly" --hide-title-bar
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

| 选项               | 描述                     | 示例                                           |
| ------------------ | ------------------------ | ---------------------------------------------- |
| `--name`           | 应用程序名称             | `--name "Weekly"`                              |
| `--icon`           | 应用程序图标             | `--icon https://cdn.tw93.fun/pake/weekly.icns` |
| `--width`          | 窗口宽度（默认：1200px） | `--width 1400`                                 |
| `--height`         | 窗口高度（默认：780px）  | `--height 900`                                 |
| `--hide-title-bar` | 沉浸式标题栏（仅macOS）  | `--hide-title-bar`                             |
| `--debug`          | 启用开发者工具           | `--debug`                                      |

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

指定应用程序的图标，支持本地或远程文件，不传此参数时，Pake 会智能获取网站图标。自定义图标可访问 [icon-icons](https://icon-icons.com) 或 [macOSicons](https://macosicons.com/#/) 下载。

- macOS 要求使用 `.icns` 格式。
- Windows 要求使用 `.ico` 格式。
- Linux 要求使用 `.png` 格式。

```shell
--icon <path>

# 示例：
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

点击关闭按钮时隐藏窗口而不是退出应用程序。默认为 `true`。

```shell
--hide-on-close
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

#### [title]

设置窗口标题栏文本。如果未指定，窗口标题将为空。

```shell
--title <string>

# 示例：
--title "我的应用"
--title "音乐播放器"
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

## 开发调试

开发时可以修改 `bin/defaults.ts` 中 `DEFAULT_DEV_PAKE_OPTIONS` 配置，配置项和 `pake-cli` 配置说明保持一致

```typescript
export const DEFAULT_DEV_PAKE_OPTIONS: PakeCliOptions & { url: string } = {
  ...DEFAULT_PAKE_OPTIONS,
  url: "https://weekly.tw93.fun/",
  name: "Weekly",
};
```

之后运行

```bash
pnpm run cli:dev
```

脚本会读取上述配置并使用 `watch` 模式打包指定的 `app`，对 `pake-cli` 代码和 `pake` 的修改都会实时热更新。

## Docker 使用

```shell
# 在Linux上，您可以通过 Docker 运行 Pake CLI。
docker run -it --rm \ # Run interactively, remove container after exit
    -v YOUR_DIR:/output \ # Files from container's /output will be in YOU_DIR
    ghcr.io/tw93/pake \
    <arguments>

# For example:
docker run -it --rm \
    -v ./packages:/output \
    ghcr.io/tw93/pake \
    https://example.com --name myapp --icon ./icon.png

```
