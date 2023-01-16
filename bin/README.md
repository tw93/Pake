## 安装

请确保 Node 版本>=16 如 16.8，不要使用 sudo 进行安装：

```bash
npm install -g pake-cli
```

假如 npm 报没有权限可以参考 [How to fix npm throwing error without sudo](https://stackoverflow.com/questions/16151018/how-to-fix-npm-throwing-error-without-sudo)。

## Windows 和 Linux 用户注意点

- 查看 tauri 提供的[依赖指南](https://tauri.app/v1/guides/getting-started/prerequisites)（**十分重要**）
- 对于 windows（至少安装了`Win10 SDK(10.0.19041.0)` 与`Visual Studio build tool 2022（>=17.2）`），还需要额外安装：

  1. Microsoft Visual C++ 2015-2022 Redistributable (x64)
  2. Microsoft Visual C++ 2015-2022 Redistributable (x86)
  3. Microsoft Visual C++ 2012 Redistributable (x86)（可选）
  4. Microsoft Visual C++ 2013 Redistributable (x86)（可选）
  5. Microsoft Visual C++ 2008 Redistributable (x86)（可选）

- 此外 Ubuntu 在开始之前可以运行如下命令，安装前期所需依赖。

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

## 用法

```bash
pake url [options]
```

打包完成后的应用程序默认为当前工作目录，首次打包由于需配置好环境，需要一些时间，请耐心等待即可。

Note: 打包需要用 `Rust` 环境，如果没有 `Rust`，会提示确认安装。如遇安装失败或超时，可[自行安装](https://www.rust-lang.org/tools/install)。

### url

url 为你需要打包的网页链接 🔗，必须提供。

### [options]

提供了一些特定的选项，打包时可以传递对应参数达到定制化的效果。

#### [name]

应用名称，如输入时未指定，会提示你输入，尽量使用英语。

```shell
--name <value>
```

#### [icon]

应用 icon，支持本地/远程文件，默认为 Pake 自带图标，定制的可以去 [icon-icons](https://icon-icons.com) 或 [macOSicons](https://macosicons.com/#/) 搜索下载。

- MacOS 下必须为 `.icns`
- Windows 下必须为 `.ico`
- Linux 下必须为 `.png`

```shell
--icon <path>
```

#### [height]

打包后的应用窗口高度，默认 `780px`。

```shell
--height <number>
```

#### [width]

打包后的应用窗口宽度，默认 `1200px`。

```shell
--width <number>
```

#### [transparent]

是否开启沉浸式头部，默认为 `false` 不开启。

```shell
--transparent
```

#### [resize]

是否可以拖动大小，默认为 `true` 可拖动。

```shell
--no-resizable
```

#### [fullscreen]

打开应用后是否开启全屏，默认为 `false`。

```shell
--fullscreen <value>
```
