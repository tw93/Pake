## 安装

```bash
npm install -g pake-cli
```

如果安装失败提示没有权限，请使用 `sudo` 运行。

## 用法

```bash
pake [options] url
```

打包完成后的应用程序默认为当前工作目录，首次打包由于需配置好环境，需要一些时间，请耐心等待即可。

Note: 打包需要用 `Rust` 环境，如果没有 `Rust`，会提示确认安装。如遇安装失败或超时，可[自行安装](https://www.rust-lang.org/tools/install)。

Note: 目前仅支持 MacOs，后续会支持其他平台。

### url

url 为你需要打包的网页链接 🔗，必须提供。

### [options]

提供了一些特定的选项，打包时可以传递对应参数达到定制化的效果。

#### [name]

应用名称，如输入时未指定，会提示你输入。

```shell
--name <value>
```

#### [icon]

应用 icon，支持本地/远程文件，默认为 Pake 自带图标。

- MacOS 下必须为 `.icns`

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
