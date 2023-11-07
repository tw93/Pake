<h4 align="right"><strong><a href="https://github.com/tw93/Pake/tree/master/bin">English</a></strong> | 简体中文</h4>

## 安装

请确保您的 Node.js 版本为 16 或更高版本（例如 16.8）。请避免使用 `sudo` 进行安装。如果 npm 报告权限问题，请参考 [如何在不使用 sudo 的情况下修复 npm 报错](https://stackoverflow.com/questions/16151018/how-to-fix-npm-throwing-error-without-sudo)。

```bash
npm install pake-cli -g 
```

## Windows/Linux 注意事项

- **非常重要**：请参阅 Tauri 的 [依赖项指南](https://tauri.app/v1/guides/getting-started/prerequisites)。
- 对于 Windows 用户，请确保至少安装了 `Win10 SDK(10.0.19041.0)` 和 `Visual Studio Build Tools 2022（版本 17.2 或更高）`，此外还需要安装以下组件：

  1. Microsoft Visual C++ 2015-2022 Redistributable (x64)
  2. Microsoft Visual C++ 2015-2022 Redistributable (x86)
  3. Microsoft Visual C++ 2012 Redistributable (x86)（可选）
  4. Microsoft Visual C++ 2013 Redistributable (x86)（可选）
  5. Microsoft Visual C++ 2008 Redistributable (x86)（可选）

- 对于 Ubuntu 用户，在开始之前，建议运行以下命令以安装所需的依赖项：

  ```bash
  sudo apt install libdbus-1-dev \
      libsoup2.4-dev \
      libjavascriptcoregtk-4.0-dev \
      libwebkit2gtk-4.0-dev \
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

## 使用方法

### 开发
开发时可以修改 `bin/defaults.ts` 中 `DEFAULT_DEV_PAKE_OPTIONS` 配置，配置项和 `pake-cli` 配置说明保持一致

```typescript
export const DEFAULT_DEV_PAKE_OPTIONS: PakeCliOptions & {url: string} = {
  ...DEFAULT_PAKE_OPTIONS,
  url: 'https://weread.qq.com',
  name: 'Weread',
}
```

之后运行

```bash
yarn cli:dev
```

脚本会读取上述配置并使用 `watch` 模式打包指定的 `app`，对 `pake-cli` 代码和 `pake` 的修改都会实时热更新。


### 使用 CLI

```bash
pake [url] [options]
```

应用程序的打包结果将默认保存在当前工作目录。由于首次打包需要配置环境，这可能需要一些时间，请耐心等待。

> **注意**：打包过程需要使用 `Rust` 环境。如果您没有安装 `Rust`，系统会提示您是否要安装。如果遇到安装失败或超时的问题，您可以 [手动安装](https://www.rust-lang.org/tools/install)。

### [url]

`url` 是您需要打包的网页链接 🔗 或本地 HTML 文件的路径，此参数为必填。

### [options]

您可以通过传递以下选项来定制打包过程：

#### [name]

指定应用程序的名称。如果在输入时未指定，系统会提示您输入。建议使用英文名称。

```shell
--name <value>
```

#### [icon]

指定应用程序的图标，支持本地或远程文件。默认使用 Pake 的内置图标。您可以访问 [icon-icons](https://icon-icons.com)
或 [macOSicons](https://macosicons.com/#/) 下载自定义图标。

- macOS 要求使用 `.icns` 格式。
- Windows 要求使用 `.ico` 格式。
- Linux 要求使用 `.png` 格式。

```shell
--icon <path>
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

#### [transparent]

设置是否启用沉浸式头部，默认为 `false`（不启用）。当前只对 macOS 上有效。

```shell
--transparent
```

#### [fullscreen]

设置应用程序是否在启动时自动全屏，默认为 `false`。使用以下命令可以设置应用程序启动时自动全屏。

```shell
--fullscreen
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

选择输出的包格式，支持 `deb`、`appimage` 或 `all`。如果选择 `all`，则会同时打包 `deb` 和 `appimage`。此选项仅适用于
Linux，默认为 `all`。

```shell
--targets <value>
```

#### [user-agent]

自定义浏览器的用户代理请求头，默认为空。

```shell
--user-agent <value>
```

#### [show-menu]

设置是否显示菜单栏，默认不显示。在 macOS 上推荐启用此选项。

```shell
--show-menu
```

#### [show-system-tray]

设置是否显示通知栏托盘，默认不显示。

```shell
--show-system-tray
```

#### [system-tray-icon]

设置通知栏托盘图标，仅在启用通知栏托盘时有效。图标必须为 `.ico` 或 `.png` 格式，分辨率为 32x32 到 256x256 像素。

```shell
--system-tray-icon <path>
```

#### [iter-copy-file]

当 `url` 为本地文件路径时，如果启用此选项，则会递归地将 `url` 路径文件所在的文件夹及其所有子文件复

制到 Pake 的静态文件夹。默认不启用。

```shell
--iter-copy-file
```

#### [inject]

使用 `inject` 可以通过本地的绝对、相对路径的 `css` `js` 文件注入到你所指定 `url` 的页面中，从而为

其做定制化改造。举个例子：一段可以通用到任何网页的广告屏蔽脚本，或者是优化页面 `UI` 展的 `css`，你

只需要书写一次可以将其通用到任何其他网页打包的 `app`。

```shell
--inject ./tools/style.css --inject ./tools/hotkey.js
```

#### [safe-domain]

这个安全域名是除你当前配置的 `url` 之外可能会出现重定向或跳转到的其他域名，只有在已配置为安全的域名中，

才能够使用 `tauri` 暴露到浏览器的 `api` ，保证 `pake` 内置增强功能的正确运行。

PS: 安全域名不需要携带协议。

```shell
--safe-domain weread.qq.com,google.com
```

## 结语

完成上述步骤后，您的应用程序应该已经成功打包。请注意，根据您的系统配置和网络状况，打包过程可能需要一些时间。请耐心等待，一旦打包完成，您就可以在指定的目录中找到应用程序安装包。
