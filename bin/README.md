## 安装

```bash
npm install -g pake-cli
```

如果安装失败提示没有权限，请参考该贴解决：[链接](https://gist.github.com/Giancarlos/d087f8a9e6516716da98ad0c0f5a8f58)。

此外，请确保你使用的是正确的 Node.js 版本（`^14.13 || >=16.0.0`）。如果你在使用 [nvm](https://github.com/nvm-sh/nvm) 进行 Node.js 版本管理，可以尝试在项目的目录下运行 `nvm use`，就会拿到正确的版本；其他一众 Node.js 版本工具，比如 [fnm](https://github.com/Schniz/fnm)、[tj/n](https://github.com/tj/n) 应该也有类似的功能。

**尽量不要使用 `sudo` 权限**。 如果实在要用sudo，请手动安装rust到系统环境。Mac可以用brew命令安装，Linux如Ubuntu可以用apt命令安装。


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

应用 icon，支持本地/远程文件，默认为 Pake 自带图标。
（可以去 https://icon-icons.com 搜索下载）

- MacOS 下必须为 `.icns`
- Windows 下必须为 `.ico`
- Linux 下必须为 `.png`

```shell
--icon <path>
```

#### [height]

打包后的应用窗口高度，默认 `800px`。

```shell
--height <number>
```

#### [width]

打包后的应用窗口宽度，默认 `1280px`。

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
